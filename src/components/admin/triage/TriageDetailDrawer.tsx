import { useState } from "react";
import type { TriageItem } from "@/hooks/useAttendanceTriage";
import { useAuditLog, type AuditEntry } from "@/hooks/useAuditLog";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { useSession } from "@/hooks/useSession";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  PenLine,
  Clock,
  User,
  FileText,
  AlertCircle,
  Send,
  ChevronDown,
  Bug,
  Copy,
} from "lucide-react";
import { toZonedTime } from "date-fns-tz";
import { useAdminMembership as useAdminMembershipForTz } from "@/hooks/useAdminMembership";

const DIAG = import.meta.env.DEV || localStorage.getItem("edvera_diag") === "1";

interface Props {
  item: TriageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (id: string, status: string, note?: string) => void;
  isUpdating: boolean;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-destructive/15 text-destructive border-destructive/30" },
  in_review: { label: "In Review", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  needs_info: { label: "Needs Info", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
  resolved: { label: "Accepted", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  accepted: { label: "Accepted", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  corrected: { label: "Corrected", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const TIMELINE_ICON: Record<string, typeof CheckCircle> = {
  RESOLVE_TRIAGE: CheckCircle,
  REJECT_TRIAGE: XCircle,
  NEEDS_INFO_TRIAGE: HelpCircle,
  CORRECT_TRIAGE: PenLine,
  REVIEW_TRIAGE: Clock,
  CREATE_TRIAGE: Send,
};

const TIMELINE_LABEL: Record<string, string> = {
  RESOLVE_TRIAGE: "Accepted",
  REJECT_TRIAGE: "Rejected",
  NEEDS_INFO_TRIAGE: "Needs Info requested",
  CORRECT_TRIAGE: "Corrected",
  REVIEW_TRIAGE: "Marked In Review",
  CREATE_TRIAGE: "Notice submitted",
};

const TEMPLATES = [
  "Please upload a doctor's note",
  "Please confirm pickup time",
  "Please call the front office",
];

const isActionable = (status: string) =>
  ["new", "in_review", "needs_info"].includes(status);

export function TriageDetailDrawer({ item, open, onOpenChange, onAction, isUpdating }: Props) {
  const mobile = useIsMobile();
  const { schoolId } = useAdminMembership();
  const { user } = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Fetch audit_log entries for this triage item
  const auditQuery = useAuditLog(schoolId, 50);
  const timeline = (auditQuery.data ?? []).filter(
    (e) => e.entity === "attendance_triage" && e.entity_id === item?.id
  );

  // Reset note when item changes
  const handleOpen = (o: boolean) => {
    if (o && item) setNoteText(item.admin_note ?? "");
    onOpenChange(o);
  };

  const handleSaveNote = async () => {
    if (!item || !noteText.trim() || !user || !schoolId) return;
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from("attendance_triage")
        .update({ admin_note: noteText } as any)
        .eq("id", item.id);
      if (error) throw error;

      await supabase.from("audit_log").insert({
        school_id: schoolId,
        actor_user_id: user.id,
        action: "NOTE_TRIAGE",
        entity: "attendance_triage",
        entity_id: item.id,
        meta: { note: noteText },
      } as any);

      qc.invalidateQueries({ queryKey: ["attendance_triage"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
      toast({ title: "Note saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  if (!item) return null;

  const badge = STATUS_BADGE[item.triage_status] ?? STATUS_BADGE.new;
  const actionable = isActionable(item.triage_status);

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col overflow-hidden",
          mobile ? "h-[85vh] rounded-t-2xl" : "w-[420px] sm:max-w-[420px]"
        )}
      >
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle className="text-lg font-bold tracking-tight">
            Notice Details
          </SheetTitle>
        </SheetHeader>

         <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Section 1: Summary */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{item.child_name ?? "Student"}</span>
                <Badge variant="outline" className="text-[10px]">{item.submitted_status}</Badge>
              </div>
              {item.parent_name && (
                <p className="text-[11px] text-muted-foreground">Parent: {item.parent_name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {format(new Date(item.attendance_date), "EEEE, MMMM d, yyyy")}
              </p>
              {item.submitted_reason && (
                <p className="text-sm bg-secondary/60 rounded-lg px-3 py-2 text-foreground/80">
                  "{item.submitted_reason}"
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted {format(new Date(item.created_at), "MMM d, h:mm a")}
              </p>
            </div>
          </section>

          <Separator />

          {/* Section 2: Current Status */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Status</h4>
            <Badge className={cn("text-sm px-3 py-1 border", badge.className)}>
              {badge.label}
            </Badge>
            {item.triage_status === "needs_info" && item.admin_note && (
              <div className="flex items-start gap-2 bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-border))] rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 text-[hsl(var(--status-warning-text))] mt-0.5 shrink-0" />
                <p className="text-xs text-[hsl(var(--status-warning-text))]">{item.admin_note}</p>
              </div>
            )}
          </section>

          <Separator />

          {/* Section 3: Timeline */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</h4>
            <div className="space-y-0">
              {/* Initial submission (always shown) */}
              <TimelineEntry
                icon={Send}
                label="Parent submitted notice"
                actor="Parent"
                time={item.created_at}
              />
              {timeline.map((entry) => {
                const Icon = TIMELINE_ICON[entry.action] ?? FileText;
                const label = TIMELINE_LABEL[entry.action] ?? entry.action.replace(/_/g, " ");
                return (
                  <TimelineEntry
                    key={entry.id}
                    icon={Icon}
                    label={label}
                    actor="Office"
                    time={entry.created_at}
                    meta={entry.meta}
                  />
                );
              })}
              {timeline.length === 0 && (
                <p className="text-xs text-muted-foreground/60 pl-8">No further activity yet</p>
              )}
            </div>
          </section>

          <Separator />

          {/* Section 4: Staff Note */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internal Note</h4>

            {/* Template buttons for needs_info */}
            {item.triage_status === "needs_info" && (
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    onClick={() => setNoteText(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            )}

            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add internal note..."
              className="text-sm min-h-[80px]"
            />
            <Button
              size="sm"
              className="text-xs"
              onClick={() => {
                if (DIAG) console.log("[ATTEND_AUDIT_ADMIN]", { triageId: item.id, action: "SaveNote", fromStatus: item.triage_status, toStatus: item.triage_status, admin_note_length: noteText.trim().length });
                handleSaveNote();
              }}
              disabled={savingNote || !noteText.trim()}
            >
              {savingNote ? "Saving..." : "Save Note"}
            </Button>
          </section>

          {/* Action buttons */}
          {actionable && (
            <>
              <Separator />
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="h-9 text-xs gap-1.5 bg-[hsl(var(--status-success-text))] hover:bg-[hsl(var(--status-success-text))]/90 text-white"
                    onClick={() => {
                      if (DIAG) console.log("[ATTEND_AUDIT_ADMIN]", { triageId: item.id, action: "Accept", fromStatus: item.triage_status, toStatus: "resolved", resolved_at: new Date().toISOString(), admin_note_length: noteText.trim().length });
                      onAction(item.id, "resolved"); onOpenChange(false);
                    }}
                    disabled={isUpdating}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5 border-[hsl(var(--status-warning-border))] text-[hsl(var(--status-warning-text))] hover:bg-[hsl(var(--status-warning-bg))]"
                    onClick={() => {
                      if (!noteText.trim()) {
                        toast({ title: "Note required", description: "Please add a note before marking as Needs Info.", variant: "destructive" });
                        return;
                      }
                      if (DIAG) console.log("[ATTEND_AUDIT_ADMIN]", { triageId: item.id, action: "NeedsInfo", fromStatus: item.triage_status, toStatus: "needs_info", admin_note_length: noteText.trim().length });
                      onAction(item.id, "needs_info", noteText);
                      onOpenChange(false);
                    }}
                    disabled={isUpdating}
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Needs Info
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5"
                    onClick={() => { onAction(item.id, "corrected", noteText); onOpenChange(false); }}
                    disabled={isUpdating}
                  >
                    <PenLine className="w-3.5 h-3.5" /> Correct
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => { onAction(item.id, "rejected"); onOpenChange(false); }}
                    disabled={isUpdating}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </section>
            </>
          )}

          {/* DEV-ONLY: Audit & Diagnostics */}
          {DIAG && (() => {
            const clientNow = new Date();
            const adminTz = (useAdminMembershipForTz as any)?.timezone ?? "America/Los_Angeles";
            const schoolNow = toZonedTime(clientNow, adminTz);

            const auditSnapshot = {
              triage_id: item.id,
              child_id: item.child_id,
              attendance_date: item.attendance_date,
              triage_status: item.triage_status,
              admin_note: item.admin_note,
              resolved_by: item.resolved_by,
              resolved_at: item.resolved_at,
              source_attendance_entry_id: (item as any).source_attendance_entry_id,
              created_at: item.created_at,
              updated_at: (item as any).updated_at,
              submitted_status: item.submitted_status,
              submitted_reason: item.submitted_reason,
              dates: {
                client_local: format(clientNow, "yyyy-MM-dd HH:mm:ss"),
                school_tz_date: format(schoolNow, "yyyy-MM-dd"),
              },
              audit_log_count: timeline.length,
            };

            const copyAuditSnapshot = () => {
              navigator.clipboard.writeText(JSON.stringify(auditSnapshot, null, 2));
            };

            return (
              <>
                <Separator />
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                    <Bug className="w-3.5 h-3.5 text-muted-foreground" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit (dev only)</h4>
                    <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {/* Timezone audit */}
                    <div className="bg-secondary/50 rounded-lg p-2 space-y-1 text-[11px] font-mono text-foreground/80">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1 font-sans">⏰ Timezone</p>
                      <p><span className="text-muted-foreground">client_local:</span> {format(clientNow, "yyyy-MM-dd HH:mm:ss")}</p>
                      <p><span className="text-muted-foreground">school_tz_date:</span> {format(schoolNow, "yyyy-MM-dd")}</p>
                    </div>

                    <div className="bg-secondary/50 rounded-lg p-3 space-y-1.5 text-[11px] font-mono text-foreground/80">
                      <p><span className="text-muted-foreground">triage_id:</span> {item.id}</p>
                      <p><span className="text-muted-foreground">child_id:</span> {item.child_id}</p>
                      <p><span className="text-muted-foreground">source_entry_id:</span> {(item as any).source_attendance_entry_id ?? "—"}</p>
                      <p><span className="text-muted-foreground">triage_status:</span> {item.triage_status}</p>
                      <p><span className="text-muted-foreground">attendance_date:</span> {item.attendance_date}</p>
                      <p><span className="text-muted-foreground">created_at:</span> {item.created_at}</p>
                      <p><span className="text-muted-foreground">updated_at:</span> {(item as any).updated_at ?? "—"}</p>
                      <p><span className="text-muted-foreground">resolved_by:</span> {item.resolved_by ?? "—"}</p>
                      <p><span className="text-muted-foreground">resolved_at:</span> {item.resolved_at ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Audit Log Entries:</p>
                      {timeline.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground/60">No audit log entries</p>
                      ) : (
                        <div className="space-y-1">
                          {timeline.map((e) => (
                            <p key={e.id} className="text-[10px] font-mono text-foreground/70">
                              {format(new Date(e.created_at), "HH:mm:ss")} — {e.action}
                              {(e.meta as any)?.triage_status ? ` → ${(e.meta as any).triage_status}` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={copyAuditSnapshot}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copy audit snapshot
                    </button>
                  </CollapsibleContent>
                </Collapsible>
              </>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Timeline entry sub-component
function TimelineEntry({
  icon: Icon,
  label,
  actor,
  time,
  meta,
}: {
  icon: typeof CheckCircle;
  label: string;
  actor: string;
  time: string;
  meta?: Record<string, unknown>;
}) {
  return (
    <div className="flex gap-3 py-2">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <Icon className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="flex-1 w-px bg-border" />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{actor}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(time), { addSuffix: true })}
          </span>
        </div>
        {meta && (meta as any).note && (
          <p className="text-[11px] text-muted-foreground/80 mt-1 italic">"{(meta as any).note}"</p>
        )}
      </div>
    </div>
  );
}
