import { useMemo } from "react";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useAttendanceEntries } from "@/hooks/useAttendanceEntries";
import { usePendingAttendanceNotice } from "@/hooks/usePendingAttendanceNotice";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Bug, ChevronDown, Copy } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const DIAG = import.meta.env.DEV || localStorage.getItem("edvera_diag") === "1";

function deriveParentUIState(
  todayEntry: any | undefined,
  pendingNotice: any | null,
  triageRow: any | null
): string {
  if (pendingNotice?.triage_status === "needs_info") return "NEEDS_INFO";
  if (triageRow?.triage_status === "resolved") return "CONFIRMED";
  if (triageRow?.triage_status === "rejected") return "REJECTED";
  if (triageRow?.triage_status === "corrected") return "CORRECTED";
  if (todayEntry && todayEntry.status !== "present") return "SUBMITTED";
  return "NONE";
}

export function AttendanceDebugPanel() {
  const { selectedChild, school } = useSelectedChild();
  const { entries, todayDate } = useAttendanceEntries();
  const { data: pendingNotice } = usePendingAttendanceNotice(selectedChild?.id);

  const tz = (school as any)?.timezone ?? "America/Los_Angeles";
  const clientLocalNow = new Date();
  const schoolNow = toZonedTime(clientLocalNow, tz);
  const schoolDateStr = format(schoolNow, "yyyy-MM-dd");

  const todayEntry = useMemo(
    () =>
      selectedChild
        ? entries.find(
            (e) => e.child_id === selectedChild.id && e.attendance_date === todayDate
          )
        : undefined,
    [entries, selectedChild, todayDate]
  );

  const triageQuery = useQuery({
    queryKey: ["debug_triage_row", selectedChild?.id, todayDate],
    queryFn: async () => {
      if (!selectedChild?.id || !todayDate) return null;
      const { data, error } = await supabase
        .from("attendance_triage")
        .select("id, triage_status, admin_note, resolved_at, resolved_by, source_attendance_entry_id, created_at, updated_at")
        .eq("child_id", selectedChild.id)
        .eq("attendance_date", todayDate)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: DIAG && !!selectedChild?.id && !!todayDate,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const triageRow = triageQuery.data;
  const derivedState = deriveParentUIState(todayEntry, pendingNotice, triageRow);

  const auditSnapshot = useMemo(() => {
    const snap = {
      child_id: selectedChild?.id,
      child_name: selectedChild?.display_name,
      dates: {
        client_local: format(clientLocalNow, "yyyy-MM-dd HH:mm:ss"),
        school_tz_date: schoolDateStr,
        query_attendance_date: todayDate,
        timezone: tz,
      },
      attendance_entry: todayEntry
        ? { id: todayEntry.id, attendance_date: todayEntry.attendance_date, status: todayEntry.status, reason: todayEntry.reason, created_at: todayEntry.created_at, updated_at: todayEntry.updated_at }
        : null,
      triage_row: triageRow ?? null,
      pending_notice_hook: pendingNotice
        ? { id: pendingNotice.id, triage_status: pendingNotice.triage_status, admin_note: pendingNotice.admin_note }
        : null,
      derived_ui_state: derivedState,
    };
    if (DIAG) console.log("[ATTEND_AUDIT_PARENT]", snap);
    return snap;
  }, [selectedChild, todayEntry, triageRow, pendingNotice, derivedState, todayDate, schoolDateStr, tz]);

  if (!DIAG) return null;

  const copySnapshot = () => {
    navigator.clipboard.writeText(JSON.stringify(auditSnapshot, null, 2));
  };

  return (
    <Collapsible className="pulse-card border-dashed border-2 border-muted-foreground/30 animate-fade-in">
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
        <Bug className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Attendance Debug Panel (dev)
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        {/* Timezone audit */}
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-[11px] font-mono text-foreground/80">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1 font-sans">⏰ Timezone Audit</p>
          <p><span className="text-muted-foreground">client_local:</span> {format(clientLocalNow, "yyyy-MM-dd HH:mm:ss")}</p>
          <p><span className="text-muted-foreground">school_tz_date:</span> {schoolDateStr} <span className="text-muted-foreground/60">({tz})</span></p>
          <p><span className="text-muted-foreground">query_date:</span> {todayDate}</p>
          {schoolDateStr !== todayDate && (
            <p className="text-destructive font-bold">⚠️ DATE MISMATCH — school tz date ≠ query date!</p>
          )}
        </div>

        {/* Attendance Entry */}
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-[11px] font-mono text-foreground/80">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1 font-sans">📋 attendance_entries (today)</p>
          {todayEntry ? (
            <>
              <p><span className="text-muted-foreground">id:</span> {todayEntry.id}</p>
              <p><span className="text-muted-foreground">date:</span> {todayEntry.attendance_date}</p>
              <p><span className="text-muted-foreground">status:</span> {todayEntry.status}</p>
              <p><span className="text-muted-foreground">reason:</span> {todayEntry.reason ?? "—"}</p>
              <p><span className="text-muted-foreground">created_at:</span> {todayEntry.created_at}</p>
              <p><span className="text-muted-foreground">updated_at:</span> {todayEntry.updated_at}</p>
            </>
          ) : (
            <p className="text-muted-foreground/60">No entry for today</p>
          )}
        </div>

        {/* Triage Row */}
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-[11px] font-mono text-foreground/80">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1 font-sans">🔍 attendance_triage (today)</p>
          {triageRow ? (
            <>
              <p><span className="text-muted-foreground">id:</span> {(triageRow as any).id}</p>
              <p><span className="text-muted-foreground">triage_status:</span> <strong>{(triageRow as any).triage_status}</strong></p>
              <p><span className="text-muted-foreground">admin_note:</span> {(triageRow as any).admin_note ?? "—"}</p>
              <p><span className="text-muted-foreground">resolved_at:</span> {(triageRow as any).resolved_at ?? "—"}</p>
              <p><span className="text-muted-foreground">resolved_by:</span> {(triageRow as any).resolved_by ?? "—"}</p>
              <p><span className="text-muted-foreground">source_entry_id:</span> {(triageRow as any).source_attendance_entry_id ?? "—"}</p>
              <p><span className="text-muted-foreground">created_at:</span> {(triageRow as any).created_at}</p>
              <p><span className="text-muted-foreground">updated_at:</span> {(triageRow as any).updated_at}</p>
            </>
          ) : (
            <p className="text-muted-foreground/60">No triage row for today</p>
          )}
        </div>

        {/* Derived state */}
        <div className="bg-secondary/50 rounded-lg p-3 text-[11px] font-mono text-foreground/80">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1 font-sans">🎯 Derived UI State</p>
          <p className="text-sm font-bold">{derivedState}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            pendingNotice hook: {pendingNotice ? `${pendingNotice.triage_status} (id: ${pendingNotice.id})` : "null"}
          </p>
        </div>

        <button
          onClick={copySnapshot}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="w-3 h-3" /> Copy audit snapshot
        </button>
      </CollapsibleContent>
    </Collapsible>
  );
}
