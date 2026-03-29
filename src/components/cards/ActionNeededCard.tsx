import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Check, X, Clock, Plus, ListTodo, StickyNote, ClipboardList, AlertCircle, Eye, CalendarX, ArrowRightFromLine, Calendar, CheckCircle2, ShieldCheck, FileText, Pencil, MessageSquare } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { AttendanceReceiptDrawer } from "@/components/modals/AttendanceReceiptDrawer";
import { CorrectionConfirmDrawer } from "@/components/modals/CorrectionConfirmDrawer";
import { cn } from "@/lib/utils";
import { useActionCenter } from "@/hooks/useActionCenter";
import { ActionItem, ActionPriority } from "@/types/actionCenter";
import { MarkAttendanceModal } from "@/components/modals/MarkAttendanceModal";
import { TodoDetailsModal } from "@/components/modals/TodoDetailsModal";
import { AddTodoModal } from "@/components/modals/AddTodoModal";
import { NotesModal } from "@/components/modals/NotesModal";
import { TodosModal } from "@/components/modals/TodosModal";
import { ParentNoticeDetailModal } from "@/components/modals/ParentNoticeDetailModal";
import { toast } from "sonner";
import { useAttendanceEntries } from "@/hooks/useAttendanceEntries";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useNoSchoolDays } from "@/hooks/useNoSchoolDays";
import { usePendingAttendanceNotice, NOTICE_STATUS_DISPLAY } from "@/hooks/usePendingAttendanceNotice";
import { useComingUp } from "@/hooks/useComingUp";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isToday as isTodayFn, isTomorrow as isTomorrowFn, isPast, parseISO, format } from "date-fns";

// ── Preview limits ──
const TODO_PREVIEW_LIMIT = 2;
const NOTE_PREVIEW_LIMIT = 1;
const EXPAND_CAP = 6;

interface ActionNeededCardProps {
  onItemTap?: (item: ActionItem) => void;
  onReviewAll?: () => void;
}

// ── Contextual due-date label ──
type DueLabel = "OVERDUE" | "TODAY" | "TOMORROW" | "SOON" | "NO DATE";

function getDueLabel(item: ActionItem): DueLabel {
  if (!item.dueAt) return "NO DATE";
  const d = parseISO(item.dueAt);
  if (isPast(d) && !isTodayFn(d)) return "OVERDUE";
  if (isTodayFn(d)) return "TODAY";
  if (isTomorrowFn(d)) return "TOMORROW";
  return "SOON";
}

function DueLabelBadge({ label }: { label: DueLabel }) {
  const styles: Record<DueLabel, string> = {
    OVERDUE: "bg-status-urgent-bg text-status-urgent-text border border-status-urgent-border",
    TODAY: "bg-status-caution-bg text-status-caution-text border border-status-caution-border",
    TOMORROW: "bg-status-warning-bg text-status-warning-text border border-status-warning-border",
    SOON: "bg-secondary text-secondary-foreground border border-border",
    "NO DATE": "bg-secondary text-muted-foreground border border-border",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide", styles[label])}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ActionPriority }) {
  const styles: Record<ActionPriority, string> = {
    urgent: "bg-status-urgent-bg text-status-urgent-text border border-status-urgent-border",
    soon: "bg-status-warning-bg text-status-warning-text border border-status-warning-border",
    fyi: "bg-secondary text-secondary-foreground border border-border",
  };
  const labels: Record<ActionPriority, string> = {
    urgent: "Urgent",
    soon: "Soon",
    fyi: "FYI",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide", styles[priority])}>
      {labels[priority]}
    </span>
  );
}

// ── Derive parent-facing UI state from triage ──
function deriveAttendanceUIState(
  todayEntry: any | undefined,
  pendingNotice: any | null,
  triageRow: any | null
): "NONE" | "SUBMITTED" | "NEEDS_INFO" | "CONFIRMED" | "CORRECTION_PENDING" {
  if (pendingNotice?.triage_status === "needs_info") return "NEEDS_INFO";
  if (triageRow?.triage_status === "resolved") return "CONFIRMED";
  // Correction: triage is 'new' but was previously resolved (resolved_at exists)
  if (
    triageRow?.triage_status === "new" &&
    triageRow?.resolved_at !== null &&
    triageRow?.resolved_at !== undefined &&
    todayEntry &&
    todayEntry.status !== "present"
  ) {
    return "CORRECTION_PENDING";
  }
  if (todayEntry && todayEntry.status !== "present") return "SUBMITTED";
  return "NONE";
}

function getStatusLabel(status: string): string {
  if (status === "tardy") return "Running Late";
  if (status === "absent") return "Absent";
  if (status === "leave_early") return "Leaving Early";
  return status;
}

// ── Attendance Status Section (status-aware) ──
function AttendanceStatusSection({
  userId,
  selectedChild,
  entries,
  todayDate,
  pendingNotice,
  onOpenAttendanceModal,
}: {
  userId: string | null;
  selectedChild: any;
  entries: any[];
  todayDate: string;
  pendingNotice: any;
  onOpenAttendanceModal: (status?: "present" | "absent" | "tardy" | "leave_early", dateOverride?: string) => void;
}) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [correctionConfirmOpen, setCorrectionConfirmOpen] = useState(false);

  // Query triage row for today
  const { data: triageRow } = useQuery({
    queryKey: ["parent_triage_status", selectedChild?.id, todayDate],
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
    enabled: !!selectedChild?.id && !!todayDate && !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  if (!userId || !selectedChild) return null;

  const todayEntry = entries.find(
    (e: any) => e.child_id === selectedChild.id && e.attendance_date === todayDate
  );

  const uiState = deriveAttendanceUIState(todayEntry, pendingNotice, triageRow);

  const handleOpenEdit = () => {
    onOpenAttendanceModal(todayEntry?.status as any, undefined);
  };

  // ── NEEDS_INFO ──
  if (uiState === "NEEDS_INFO" && pendingNotice) {
    return (
      <div className="mb-3">
        <div className="rounded-xl border-2 border-[hsl(var(--status-warning-border))] bg-[hsl(var(--status-warning-bg))]/50 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-[hsl(var(--status-warning-text))] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Office needs one detail</p>
              <p className="text-xs text-[hsl(var(--status-warning-text))] mt-1 leading-relaxed">
                {pendingNotice.admin_note || "The office requested additional details."}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-3.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenAttendanceModal(pendingNotice.submitted_status as any, pendingNotice.attendance_date);
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--status-warning-text))] text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <MessageSquare className="w-4 h-4" />
              Reply now
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setReceiptOpen(true); }}
              className="flex items-center justify-center gap-2 rounded-lg border border-[hsl(var(--status-warning-border))] text-[hsl(var(--status-warning-text))] px-4 py-2.5 text-sm font-medium hover:bg-[hsl(var(--status-warning-bg))] transition-colors"
            >
              <FileText className="w-4 h-4" />
              View receipt
            </button>
          </div>
          <p className="text-[11px] text-[hsl(var(--status-warning-text))]/70 mt-2.5 text-center">
            Replying now helps the office update attendance quickly.
          </p>
        </div>

        {todayEntry && (
          <AttendanceReceiptDrawer
            open={receiptOpen}
            onOpenChange={setReceiptOpen}
            childName={selectedChild.display_name}
            attendanceDate={todayDate}
            status={todayEntry.status}
            reason={todayEntry.reason}
            submittedAt={todayEntry.created_at}
            uiState="NEEDS_INFO"
            adminNote={pendingNotice.admin_note}
          />
        )}
      </div>
    );
  }

  // ── CORRECTION_PENDING (was confirmed, parent made a correction) ──
  if (uiState === "CORRECTION_PENDING" && todayEntry && todayEntry.status !== "present") {
    return (
      <div className="mb-3">
        <div className="rounded-xl border border-[hsl(var(--status-warning-border))] bg-[hsl(var(--status-warning-bg))]/30 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[hsl(var(--status-warning-bg))] flex items-center justify-center">
              <Clock className="w-4 h-4 text-[hsl(var(--status-warning-text))]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Update sent — awaiting review
                </p>
                <Badge variant="outline" className="text-[10px] border h-5 bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]">
                  Updated
                </Badge>
              </div>
              <p className="text-xs text-[hsl(var(--status-warning-text))]/80 mt-0.5">
                We've notified the office of your correction.
              </p>
              {todayEntry.reason && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{todayEntry.reason}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-3.5">
            <button
              onClick={() => setReceiptOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View receipt
            </button>
          </div>
          <p className="text-[11px] text-[hsl(var(--status-warning-text))]/60 mt-2.5 text-center">
            We'll only contact you if something is missing.
          </p>
        </div>

        <AttendanceReceiptDrawer
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          childName={selectedChild.display_name}
          attendanceDate={todayDate}
          status={todayEntry.status}
          reason={todayEntry.reason}
          submittedAt={todayEntry.created_at}
          uiState="SUBMITTED"
        />
      </div>
    );
  }

  // ── CONFIRMED ──
  if (uiState === "CONFIRMED" && todayEntry && todayEntry.status !== "present") {
    const statusLabel = getStatusLabel(todayEntry.status);
    const confirmedTime = triageRow?.resolved_at
      ? format(new Date(triageRow.resolved_at), "h:mm a")
      : null;

    return (
      <div className="mb-3">
        <div className="rounded-xl border border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-bg))]/30 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[hsl(var(--status-success-bg))] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[hsl(var(--status-success-text))]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Absence confirmed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Processed by the office{confirmedTime ? ` at ${confirmedTime}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-3.5">
            <button
              onClick={() => setReceiptOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View receipt
            </button>
            <button
              onClick={() => setCorrectionConfirmOpen(true)}
              disabled={triageRow?.triage_status === "new"}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground px-4 py-2.5 text-sm font-medium transition-colors",
                triageRow?.triage_status === "new" ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
              )}
            >
              <Pencil className="w-4 h-4" />
              Make a correction
            </button>
          </div>
          <p className="text-[11px] text-[hsl(var(--status-success-text))]/70 mt-2.5 text-center">
            You're all set.
          </p>
        </div>

        <AttendanceReceiptDrawer
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          childName={selectedChild.display_name}
          attendanceDate={todayDate}
          status={todayEntry.status}
          reason={todayEntry.reason}
          submittedAt={todayEntry.created_at}
          uiState="CONFIRMED"
          resolvedAt={triageRow?.resolved_at}
        />

        <CorrectionConfirmDrawer
          open={correctionConfirmOpen}
          onOpenChange={setCorrectionConfirmOpen}
          onConfirm={handleOpenEdit}
        />
      </div>
    );
  }

  // ── SUBMITTED ──
  if (uiState === "SUBMITTED" && todayEntry && todayEntry.status !== "present") {
    const submittedTime = format(new Date(todayEntry.updated_at || todayEntry.created_at), "h:mm a");
    const statusLabel = getStatusLabel(todayEntry.status);

    return (
      <div className="mb-3">
        <div className="rounded-xl border border-[hsl(var(--status-info-border))] bg-[hsl(var(--status-info-bg))]/30 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[hsl(var(--status-info-bg))] flex items-center justify-center">
              <Check className="w-4 h-4 text-[hsl(var(--status-info-text))]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Sent — awaiting review
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We'll update you when the office processes it.
              </p>
              {todayEntry.reason && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{todayEntry.reason}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-3.5">
            <button
              onClick={() => setReceiptOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View receipt
            </button>
            <button
              onClick={handleOpenEdit}
              className="flex items-center justify-center gap-2 rounded-lg border border-border text-muted-foreground px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit submission
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-2.5 text-center">
            We'll only contact you if something is missing.
          </p>
        </div>

        <AttendanceReceiptDrawer
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          childName={selectedChild.display_name}
          attendanceDate={todayDate}
          status={todayEntry.status}
          reason={todayEntry.reason}
          submittedAt={todayEntry.created_at}
          uiState="SUBMITTED"
        />
      </div>
    );
  }

  // ── NONE state: show the three buttons ──
  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-muted-foreground mb-1">Notify School</p>
      <p className="text-[11px] text-muted-foreground mb-2">Let the office know about today's attendance.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          onClick={() => onOpenAttendanceModal("tardy", undefined)}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Clock className="w-4 h-4 text-muted-foreground" />
          Running Late
        </button>
        <button
          onClick={() => onOpenAttendanceModal("absent", undefined)}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <CalendarX className="w-4 h-4 text-muted-foreground" />
          Absent Today
        </button>
        <button
          onClick={() => onOpenAttendanceModal("leave_early", undefined)}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowRightFromLine className="w-4 h-4 text-muted-foreground" />
          Leaving Early
        </button>
      </div>
    </div>
  );
}

// Status is now computed inline in the component — no standalone getStatus function needed

// AttendanceStatusRow removed — attendance insights now live only in the Insight card section

export function ActionNeededCard({ onItemTap, onReviewAll }: ActionNeededCardProps) {
  const { t } = useLanguage();
  const { selectedChild } = useSelectedChild();
  const {
    items: allItems,
    loading,
    userId,
    markDone,
    dismiss,
    snooze,
    todosHook,
    notesHook,
    schoolId,
    childId,
    activeTodosCount,
    activeNotesCount,
  } = useActionCenter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceInitialStatus, setAttendanceInitialStatus] = useState<"present" | "absent" | "tardy" | "leave_early" | undefined>(undefined);
  const [attendanceDateOverride, setAttendanceDateOverride] = useState<string | undefined>(undefined);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  // Modal state
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [addTodoOpen, setAddTodoOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [todosModalOpen, setTodosModalOpen] = useState(false);

  const selectedTodo = useMemo(
    () => todosHook.todos.find((t) => t.id === selectedTodoId) ?? null,
    [todosHook.todos, selectedTodoId]
  );

  // Attendance
  const { metrics: attendanceMetrics, entries, todayDate } = useAttendanceEntries();

  // Pending attendance notice
  const { data: pendingNotice } = usePendingAttendanceNotice(selectedChild?.id);

  // Coming up events for school
  const { school } = useSelectedChild();
  const { data: comingUpEvents = [] } = useComingUp(school?.id, 5);

  // Filter to only events happening TODAY (not tomorrow+)
  const todayOnlyEvents = useMemo(() => {
    if (!todayDate) return [];
    return comingUpEvents.filter((ev) => {
      // start_time is a timestamp — extract date portion
      const eventDate = ev.start_time?.slice(0, 10);
      return eventDate === todayDate;
    });
  }, [comingUpEvents, todayDate]);
  const comingSoonCount = todayOnlyEvents.length;

  // Scroll-to or highlight Coming Up card
  const handleComingUpClick = useCallback(() => {
    const el = document.getElementById("coming-up-card");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/40");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/40"), 1500);
    }
  }, []);

  const hideAttendanceItem = useMemo(() => {
    if (!selectedChild) return false;
    const d = new Date(`${todayDate}T00:00:00`);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return true;
    return entries.some(
      (e) => e.child_id === selectedChild.id && e.attendance_date === todayDate
    );
  }, [entries, selectedChild, todayDate]);

  const todayMarked = useMemo(() => {
    if (!selectedChild) return false;
    return entries.some(
      (e) => e.child_id === selectedChild.id && e.attendance_date === todayDate
    );
  }, [entries, selectedChild, todayDate]);

  // ── Week range for progress + no-school query ──
  const weekRange = useMemo(() => {
    if (!todayDate) return { monStr: undefined, friStr: undefined, weekdays: [] as string[] };
    const today = new Date(`${todayDate}T00:00:00`);
    const dow = today.getDay(); // 0=Sun … 6=Sat
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const monStr = monday.toISOString().slice(0, 10);
    const friStr = friday.toISOString().slice(0, 10);
    // Generate weekday strings Mon–Fri
    const weekdays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekdays.push(d.toISOString().slice(0, 10));
    }
    return { monStr, friStr, weekdays };
  }, [todayDate]);

  // Fetch no-school days (holidays, breaks) for the current week
  const { data: noSchoolDays, isLoading: noSchoolLoading } = useNoSchoolDays(
    selectedChild?.school_id,
    weekRange.monStr,
    weekRange.friStr
  );

  // ── Weekly progress (Mon–Fri minus holidays) ──
  const weeklyProgress = useMemo(() => {
    if (!selectedChild || !todayDate) return { logged: 0, total: 5 };
    const excluded = noSchoolDays ?? new Set<string>();
    const schoolDays = weekRange.weekdays.filter((d) => !excluded.has(d));
    const total = schoolDays.length;
    const logged = entries.filter(
      (e) =>
        e.child_id === selectedChild.id &&
        schoolDays.includes(e.attendance_date)
    ).length;
    return { logged: Math.min(logged, total), total };
  }, [entries, selectedChild, todayDate, weekRange.weekdays, noSchoolDays]);

  // ── Split items by category ──
  const items = useMemo(
    () => (hideAttendanceItem ? allItems.filter((i) => i.category !== "attendance") : allItems),
    [allItems, hideAttendanceItem]
  );

  const attendanceItems = useMemo(() => items.filter((i) => i.category === "attendance"), [items]);
  const todoItems = useMemo(() => items.filter((i) => i.category === "task"), [items]);
  const noteItems = useMemo(() => items.filter((i) => i.category === "note"), [items]);

  // ── Preview vs expanded slices ──
  const previewTodos = todoItems.slice(0, TODO_PREVIEW_LIMIT);
  const previewNotes = noteItems.slice(0, NOTE_PREVIEW_LIMIT);
  const expandedTodos = todoItems.slice(0, EXPAND_CAP);
  const expandedNotes = noteItems.slice(0, EXPAND_CAP);

  const hasExpandableContent =
    todoItems.length > TODO_PREVIEW_LIMIT || noteItems.length > NOTE_PREVIEW_LIMIT || attendanceItems.length > 0;

  // ── Build attentionItems: single source of truth for count + rendering ──
  const attentionItems = useMemo(() => {
    const result: { key: string; type: string; data?: any }[] = [];

    // Attendance action items (rendered as tiles)
    attendanceItems.forEach((item) => {
      result.push({ key: `attendance:${item.id}`, type: "attendance", data: item });
    });

    // To-do tiles (preview slice)
    previewTodos.forEach((item) => {
      result.push({ key: `todo:${item.id}`, type: "todo", data: item });
    });

    // Note tiles (preview slice)
    previewNotes.forEach((item) => {
      result.push({ key: `note:${item.id}`, type: "note", data: item });
    });

    // Deduplicate by key
    const seen = new Set<string>();
    const deduped = result.filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });

    if (import.meta.env.DEV) {
      console.log("attentionItems", deduped.map((i) => i.key));
    }

    return deduped;
  }, [attendanceItems, previewTodos, previewNotes]);

  const totalOpen = attentionItems.length;
  const urgentCount = useMemo(() => items.filter((i) => i.priority === "urgent").length, [items]);

  const status = useMemo(() => {
    if (urgentCount > 0) {
      return {
        emoji: "🔴",
        text: `${urgentCount} urgent item${urgentCount > 1 ? "s" : ""}`,
        containerClass: "status-container-urgent",
      };
    }
    if (totalOpen > 0) {
      return {
        emoji: "⚠️",
        text: `${totalOpen} item${totalOpen > 1 ? "s" : ""} need attention`,
        containerClass: "status-container-warning",
      };
    }
    return {
      emoji: "✅",
      text: "All clear for now.",
      subtitle: "Everything is up to date.",
      containerClass: "status-container-success",
    };
  }, [urgentCount, totalOpen]);

  // True "all clear" = no personal items, no attendance notice, no coming soon events
  const isAllClear = totalOpen === 0 && !pendingNotice && comingSoonCount === 0;

  // Handle item tap
  const handleItemTap = (item: ActionItem) => {
    if (item.id === "ac-attendance") {
      setAttendanceInitialStatus(undefined);
      setAttendanceDateOverride(undefined);
      setAttendanceModalOpen(true);
    } else if (item.id.startsWith("ac-missed:")) {
      const missedDate = item.id.replace("ac-missed:", "");
      setAttendanceInitialStatus(undefined);
      setAttendanceDateOverride(missedDate);
      setAttendanceModalOpen(true);
    } else if (item.id === "prompt:todo") {
      setTodosModalOpen(true);
    } else if (item.id === "prompt:note" || item.id.startsWith("note:")) {
      setNotesModalOpen(true);
    } else if (item.id.startsWith("todo:")) {
      setTodosModalOpen(true);
    } else {
      onItemTap?.(item);
    }
  };

  return (
    <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.05s" }}>
      {/* Header */}
      <div className="mb-3">
        <p className="text-base font-semibold text-foreground">Today</p>
        <p className="text-sm text-muted-foreground">What needs your attention</p>
      </div>

      {/* ── Notify School / Submitted state ── */}
      <AttendanceStatusSection
        userId={userId}
        selectedChild={selectedChild}
        entries={entries}
        todayDate={todayDate}
        pendingNotice={pendingNotice}
        onOpenAttendanceModal={(status, dateOverride) => {
          setAttendanceInitialStatus(status);
          setAttendanceDateOverride(dateOverride);
          setAttendanceModalOpen(true);
        }}
      />

      {/* Duplicate "Attendance Notice" card removed — status section above is the single source of truth */}

      {/* Conditional content: loading / empty / items */}
      {loading ? (
        <div className="rounded-xl p-4 status-container-success">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ) : totalOpen === 0 ? (
        <>
          {/* All clear only when truly nothing */}
          {isAllClear && (
            <div className="rounded-xl p-4 status-container-success">
              <p className="text-base font-semibold text-foreground flex items-center gap-2">
                <span>✅</span>
                <span>All clear for now.</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">Everything is up to date.</p>
            </div>
          )}

          {/* Pinned "Coming soon" row when school events exist but no personal items */}
          {!isAllClear && comingSoonCount > 0 && (
            <button
              onClick={handleComingUpClick}
              className="w-full rounded-xl p-4 status-container-success text-left group cursor-pointer transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{comingSoonCount} thing{comingSoonCount > 1 ? "s" : ""} coming up</span>
                </p>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Tap to see upcoming school events.</p>
            </button>
          )}

          {userId && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setTodosModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="whitespace-nowrap"><span className="sm:hidden">Add to-do</span><span className="hidden sm:inline">Add a school to-do</span></span>
              </button>
              <button
                onClick={() => setNotesModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <StickyNote className="w-4 h-4" />
                <span>Quick note</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={cn("rounded-xl p-4", status.containerClass)}>
            {/* Status header with expand toggle */}
            <button
              onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
              className="w-full text-left"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span>{status.emoji}</span>
                  <span>{status.text}</span>
                </p>
                {hasExpandableContent && (
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                  />
                )}
              </div>
            </button>

            {/* ── Attendance items (always in preview if present) ── */}
            {attendanceItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {attendanceItems.slice(0, 1).map((item) => (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    onTap={handleItemTap}
                    userId={userId}
                    onDone={markDone}
                    onDismiss={dismiss}
                    onSnooze={snooze}
                    badgeType="priority"
                  />
                ))}
              </div>
            )}

            {/* ── Pinned "Coming up" row inside items view ── */}
            {comingSoonCount > 0 && (
              <button
                onClick={handleComingUpClick}
                className="w-full mt-3 flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 text-left group cursor-pointer hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{comingSoonCount} thing{comingSoonCount > 1 ? "s" : ""} coming up</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            )}

            {/* ── To-dos section ── */}
            {todoItems.length > 0 && (
              <div className="mt-3">
                {previewTodos.length > 0 && (
                  <div className="space-y-2">
                    {previewTodos.map((item) => (
                      <ActionItemRow
                        key={item.id}
                        item={item}
                        onTap={handleItemTap}
                        userId={userId}
                        onDone={markDone}
                        onDismiss={dismiss}
                        onSnooze={snooze}
                        badgeType="due"
                      />
                    ))}
                  </div>
                )}

                {/* Expanded todos beyond preview */}
                {isExpanded && expandedTodos.length > TODO_PREVIEW_LIMIT && (
                  <div className="space-y-2 mt-2">
                    {expandedTodos.slice(TODO_PREVIEW_LIMIT).map((item) => (
                      <ActionItemRow
                        key={item.id}
                        item={item}
                        onTap={handleItemTap}
                        userId={userId}
                        onDone={markDone}
                        onDismiss={dismiss}
                        onSnooze={snooze}
                        badgeType="due"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Notes section ── */}
            {noteItems.length > 0 && (
              <div className="mt-3">
                {previewNotes.length > 0 && (
                  <div className="space-y-2">
                    {previewNotes.map((item) => (
                      <ActionItemRow
                        key={item.id}
                        item={item}
                        onTap={handleItemTap}
                        userId={userId}
                        onDone={markDone}
                        onDismiss={dismiss}
                        onSnooze={snooze}
                        badgeType="priority"
                      />
                    ))}
                  </div>
                )}

                {/* Expanded notes beyond preview */}
                {isExpanded && expandedNotes.length > NOTE_PREVIEW_LIMIT && (
                  <div className="space-y-2 mt-2">
                    {expandedNotes.slice(NOTE_PREVIEW_LIMIT).map((item) => (
                      <ActionItemRow
                        key={item.id}
                        item={item}
                        onTap={handleItemTap}
                        userId={userId}
                        onDone={markDone}
                        onDismiss={dismiss}
                        onSnooze={snooze}
                        badgeType="priority"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collapsed hint */}
            {!isExpanded && hasExpandableContent && (
              <button
                onClick={() => setIsExpanded(true)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                + {items.length - (previewTodos.length + previewNotes.length + Math.min(attendanceItems.length, 1))} more
              </button>
            )}
          </div>

          {/* Bottom CTAs + View all links */}
          {userId && (
            <div className="mt-3 space-y-1.5">
              <div className="flex gap-2">
                <button
                  onClick={() => setTodosModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="whitespace-nowrap"><span className="sm:hidden">Add to-do</span><span className="hidden sm:inline">Add a school to-do</span></span>
                </button>
                <button
                  onClick={() => setNotesModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <StickyNote className="w-4 h-4" />
                  <span>Quick note</span>
                </button>
              </div>
              <div className="flex items-center justify-center gap-4">
                {activeTodosCount > TODO_PREVIEW_LIMIT && (
                  <button
                    onClick={() => setTodosModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>View all To-Dos ({activeTodosCount})</span>
                  </button>
                )}
                {activeNotesCount > NOTE_PREVIEW_LIMIT && (
                  <button
                    onClick={() => setNotesModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    <span>View all Notes ({activeNotesCount})</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals — ALWAYS rendered */}
      <MarkAttendanceModal
        open={attendanceModalOpen}
        onOpenChange={(val) => {
          setAttendanceModalOpen(val);
          if (!val) { setAttendanceDateOverride(undefined); setAttendanceInitialStatus(undefined); }
        }}
        dateOverride={attendanceDateOverride}
        initialStatus={attendanceInitialStatus}
      />
      <TodoDetailsModal
        open={!!selectedTodoId}
        onOpenChange={(open) => !open && setSelectedTodoId(null)}
        todo={selectedTodo}
        onDone={(id) => { todosHook.markDone.mutate(id); setSelectedTodoId(null); }}
        onDismiss={(id) => { todosHook.dismiss.mutate(id); setSelectedTodoId(null); }}
        onSnooze={(id, date) => { todosHook.snooze.mutate({ id, newDueDate: date }); setSelectedTodoId(null); }}
      />
      <AddTodoModal
        open={addTodoOpen}
        onOpenChange={setAddTodoOpen}
        onAdd={(input) => todosHook.addTodo.mutate(input, { onError: (err: any) => toast.error(err?.message || "Couldn't add to-do. Try again.") })}
        schoolId={schoolId}
        childId={childId}
      />
      <TodosModal
        open={todosModalOpen}
        onOpenChange={setTodosModalOpen}
        todos={todosHook.todos}
        onAdd={(input) => todosHook.addTodo.mutate(input, { onError: (err: any) => toast.error(err?.message || "Couldn't add to-do. Try again.") })}
        onMarkDone={(id) => todosHook.markDone.mutate(id)}
        onDelete={(id) => todosHook.dismiss.mutate(id)}
        schoolId={schoolId}
        childId={childId}
      />
      <NotesModal
        open={notesModalOpen}
        onOpenChange={setNotesModalOpen}
        notes={notesHook.notes}
        onAdd={(input) => notesHook.addNote.mutate(input)}
        onUpdate={(input) => notesHook.updateNote.mutate(input)}
        onDelete={(id) => notesHook.deleteNote.mutate(id)}
        schoolId={schoolId}
        childId={childId}
        onAddTodos={(items) => {
          items.forEach((input) =>
            todosHook.addTodo.mutate(input, {
              onError: (err: any) =>
                toast.error(err?.message || "Couldn't add to-do. Try again."),
            })
          );
        }}
      />
      {pendingNotice && (
        <ParentNoticeDetailModal
          item={pendingNotice}
          open={noticeModalOpen}
          onOpenChange={setNoticeModalOpen}
        />
      )}
    </div>
  );
}

// ── Action Item Row ──

function ActionItemRow({
  item,
  onTap,
  userId,
  onDone,
  onDismiss,
  onSnooze,
  badgeType = "priority",
}: {
  item: ActionItem;
  onTap?: (item: ActionItem) => void;
  userId: string | null;
  onDone: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onSnooze: (id: string, hours: number) => Promise<void>;
  badgeType?: "priority" | "due";
}) {
  const [busy, setBusy] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const isPrompt = item.id.startsWith("prompt:");

  const handleAction = async (e: React.MouseEvent, action: () => Promise<void>) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error("Couldn't update item. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const snoozeOptions = [
    { label: "1 day", hours: 24 },
    { label: "3 days", hours: 72 },
    { label: "1 week", hours: 168 },
  ];

  const dueLabel = badgeType === "due" ? getDueLabel(item) : null;

  return (
    <div
      className="action-item-box flex items-start gap-3"
      onClick={() => onTap?.(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onTap?.(item)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {badgeType === "due" && dueLabel ? (
            <DueLabelBadge label={dueLabel} />
          ) : (
            item.priority && <PriorityBadge priority={item.priority} />
          )}
        </div>
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
        )}
        {userId && !isPrompt && (
          <div className="flex items-center gap-3 mt-1.5">
            <button
              disabled={busy}
              onClick={(e) => handleAction(e, () => onDone(item.id))}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
            >
              <Check className="w-3 h-3" /> Done
            </button>
            <button
              disabled={busy}
              onClick={(e) => handleAction(e, () => onDismiss(item.id))}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" /> Dismiss
            </button>
            <div className="relative">
              <button
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); setSnoozeOpen(!snoozeOpen); }}
                className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <Clock className="w-3 h-3" /> Snooze
              </button>
              {snoozeOpen && (
                <div className="absolute left-0 bottom-full mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-10 min-w-[100px]">
                  {snoozeOptions.map((opt) => (
                    <button
                      key={opt.hours}
                      className="block w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
                      onClick={(e) => {
                        handleAction(e, () => onSnooze(item.id, opt.hours));
                        setSnoozeOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />
    </div>
  );
}
