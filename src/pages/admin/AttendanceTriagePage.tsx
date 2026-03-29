import { useState, useMemo, useEffect } from "react";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { useAttendanceTriage, type TriageItem } from "@/hooks/useAttendanceTriage";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, LayoutList, LayoutGrid, Bug, ClipboardCheck } from "lucide-react";
import { isToday, parseISO, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DIAG = import.meta.env.DEV || localStorage.getItem("edvera_diag") === "1";
import { MorningRushView } from "@/components/admin/triage/MorningRushView";
import { MorningSnapshot } from "@/components/admin/triage/MorningSnapshot";
import { TriageHistoryView } from "@/components/admin/triage/TriageHistoryView";
import { TriageBatchBar } from "@/components/admin/triage/TriageBatchBar";
import { TriageDetailDrawer } from "@/components/admin/triage/TriageDetailDrawer";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Density = "compact" | "detailed";

function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensityState] = useState<Density>(() => {
    try {
      return (localStorage.getItem("triage_density") as Density) || "compact";
    } catch {
      return "compact";
    }
  });
  const setDensity = (d: Density) => {
    setDensityState(d);
    try {
      localStorage.setItem("triage_density", d);
    } catch {}
  };
  return [density, setDensity];
}

export default function AttendanceTriagePage() {
  const { schoolId } = useAdminMembership();
  const { items, isLoading, updateTriage, isUpdating } = useAttendanceTriage(schoolId, "all");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("rush");
  const [drawerItem, setDrawerItem] = useState<TriageItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [density, setDensity] = useDensity();
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Track last update time
  useEffect(() => {
    if (!isLoading) setLastUpdated(new Date());
  }, [items, isLoading]);

  const { timezone } = useAdminMembership();
  const tz = timezone ?? "America/Los_Angeles";

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["attendance_triage", schoolId] });
    setTimeout(() => setRefreshing(false), 600);
  };

  const [checksOpen, setChecksOpen] = useState(false);
  const [checksResults, setChecksResults] = useState<string[]>([]);
  const [checksRunning, setChecksRunning] = useState(false);

  const runWorkflowChecks = async () => {
    setChecksRunning(true);
    const results: string[] = [];
    const nowInTz = toZonedTime(new Date(), tz);
    const todayStr = format(nowInTz, "yyyy-MM-dd");
    const clientLocal = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    results.push(`⏰ Timezone Audit`);
    results.push(`  client_local: ${clientLocal}`);
    results.push(`  school_tz_date: ${todayStr} (${tz})`);

    const todayTriage = items.filter((i) => i.attendance_date === todayStr);
    results.push(`\n📊 Check 1: Today's triage count = ${todayTriage.length}`);

    // Check 1: Duplicates
    const seen = new Map<string, TriageItem[]>();
    items.forEach((i) => {
      const key = `${i.child_id}::${i.attendance_date}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(i);
    });
    const dupes = [...seen.entries()].filter(([, v]) => v.length > 1);
    if (dupes.length > 0) {
      results.push(`\n⚠️ Check 2: ${dupes.length} duplicate child+date combos:`);
      dupes.forEach(([key, v]) => results.push(`  ${key}: ${v.length} rows [${v.map((i) => i.id.slice(-8)).join(", ")}]`));
    } else {
      results.push(`\n✅ Check 2: No duplicate child+date combos`);
    }

    // Check 2: Resolved integrity
    const resolved = items.filter((i) => i.triage_status === "resolved");
    const missingResolvedBy = resolved.filter((i) => !i.resolved_by || !i.resolved_at);
    if (missingResolvedBy.length > 0) {
      results.push(`\n⚠️ Check 3: ${missingResolvedBy.length} resolved items missing resolved_by/resolved_at:`);
      missingResolvedBy.forEach((i) => results.push(`  ${i.id.slice(-8)} (${i.child_name})`));
    } else {
      results.push(`\n✅ Check 3: All ${resolved.length} resolved items have resolved_by & resolved_at`);
    }

    // Check 3: Needs Info integrity
    const needsInfo = items.filter((i) => i.triage_status === "needs_info");
    const missingNote = needsInfo.filter((i) => !i.admin_note?.trim());
    if (missingNote.length > 0) {
      results.push(`\n⚠️ Check 4: ${missingNote.length} needs_info items missing admin_note:`);
      missingNote.forEach((i) => results.push(`  ${i.id.slice(-8)} (${i.child_name})`));
    } else {
      results.push(`\n✅ Check 4: All ${needsInfo.length} needs_info items have admin_note`);
    }

    // Check 4: Cross-reference attendance_entries <-> triage for today
    try {
      const todayTriageChildIds = todayTriage.map((t) => t.child_id);
      const uniqueChildIds = [...new Set(todayTriageChildIds)];

      if (uniqueChildIds.length > 0) {
        const { data: todayEntries } = await supabase
          .from("attendance_entries")
          .select("id, child_id, attendance_date, status")
          .eq("attendance_date", todayStr)
          .in("child_id", uniqueChildIds);

        const entryChildIds = new Set((todayEntries ?? []).map((e: any) => e.child_id));
        const triageChildIds = new Set(uniqueChildIds);

        const triageNoEntry = [...triageChildIds].filter((id) => !entryChildIds.has(id));
        const entryNoTriage = [...entryChildIds].filter((id) => !triageChildIds.has(id));

        if (triageNoEntry.length > 0) {
          results.push(`\n⚠️ Check 5a: ${triageNoEntry.length} triage rows with NO matching attendance_entry:`);
          triageNoEntry.forEach((id) => results.push(`  child_id: …${id.slice(-8)}`));
        } else {
          results.push(`\n✅ Check 5a: All today's triage rows have matching attendance_entries`);
        }

        if (entryNoTriage.length > 0) {
          results.push(`\n⚠️ Check 5b: ${entryNoTriage.length} attendance_entries with NO matching triage row:`);
          entryNoTriage.forEach((id) => results.push(`  child_id: …${id.slice(-8)}`));
        } else {
          results.push(`\n✅ Check 5b: All today's attendance_entries have matching triage rows`);
        }
      } else {
        results.push(`\n✅ Check 5: No triage items today — cross-ref skipped`);
      }
    } catch (err: any) {
      results.push(`\n❌ Check 5: Cross-ref error: ${err.message}`);
    }

    console.group("[ATTEND_AUDIT_CHECKS]");
    results.forEach((r) => console.log(r));
    console.groupEnd();

    setChecksResults(results);
    setChecksOpen(true);
    setChecksRunning(false);
  };

  const todayItems = useMemo(
    () => items.filter((i) => isToday(parseISO(i.attendance_date))),
    [items]
  );

  const handleAction = async (id: string, triage_status: string, admin_note?: string) => {
    try {
      await updateTriage({ id, triage_status, admin_note });
      toast({ title: `Marked as ${triage_status.replace("_", " ")}` });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleBatchAction = async (triage_status: string) => {
    const ids = Array.from(selected);
    let failures = 0;
    for (const id of ids) {
      try {
        await updateTriage({ id, triage_status });
      } catch {
        failures++;
      }
    }
    setSelected(new Set());
    if (failures > 0) {
      toast({
        title: `${ids.length - failures} updated, ${failures} failed`,
        description: "Some items could not be updated. See timeline for details.",
        variant: "destructive",
      });
    } else {
      toast({ title: `${ids.length} items updated to ${triage_status.replace("_", " ")}` });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    const allSelected = ids.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance Triage</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily attendance operations center
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Dev-only workflow checks */}
          {DIAG && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground"
              onClick={runWorkflowChecks}
              disabled={checksRunning}
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> {checksRunning ? "Running…" : "Workflow Checks"}
            </Button>
          )}
          {/* Density toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setDensity("compact")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                density === "compact"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Compact
            </button>
            <button
              onClick={() => setDensity("detailed")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                density === "detailed"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Detailed
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="rush" className="flex-1 sm:flex-none">
            Morning Rush
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rush">
          {/* Morning Snapshot bar */}
          <MorningSnapshot items={todayItems} lastUpdated={lastUpdated} />

          <MorningRushView
            items={todayItems}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onAction={handleAction}
            isUpdating={isUpdating}
            onRowClick={setDrawerItem}
            density={density}
          />
        </TabsContent>

        <TabsContent value="history">
          <TriageHistoryView
            items={items}
            onAction={handleAction}
            isUpdating={isUpdating}
            onRowClick={setDrawerItem}
          />
        </TabsContent>
      </Tabs>

      {selected.size >= 1 && (
        <TriageBatchBar
          count={selected.size}
          onAction={handleBatchAction}
          isUpdating={isUpdating}
          onClear={() => setSelected(new Set())}
        />
      )}

      <TriageDetailDrawer
        item={drawerItem}
        open={!!drawerItem}
        onOpenChange={(open) => {
          if (!open) setDrawerItem(null);
        }}
        onAction={handleAction}
        isUpdating={isUpdating}
      />

      {/* Workflow Checks Modal */}
      <Dialog open={checksOpen} onOpenChange={setChecksOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Workflow Integrity Checks</DialogTitle>
          </DialogHeader>
          <pre className="text-[11px] font-mono text-foreground/80 whitespace-pre-wrap bg-secondary/50 rounded-lg p-4">
            {checksResults.join("\n")}
          </pre>
          <p className="text-[10px] text-muted-foreground">Results also logged to console as [ATTEND_AUDIT_CHECKS]</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
