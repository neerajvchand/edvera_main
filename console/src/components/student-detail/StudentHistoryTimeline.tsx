import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Phone,
  ChevronDown,
} from "lucide-react";
import type {
  AttendanceRecord,
  ComplianceCase,
  Action,
  InterventionEntry,
} from "@/hooks/useStudentDetail";
import { TIER_LABELS, fmtShortDate } from "@/hooks/useStudentDetail";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TimelineFilter = "all" | "absences" | "compliance" | "actions" | "interventions";

interface TimelineEvent {
  id: string;
  date: string;
  type: "absence" | "compliance" | "action_created" | "action_completed" | "intervention";
  icon: "red" | "amber" | "slate" | "red-filled" | "blue" | "emerald" | "purple";
  title: string;
  subtitle?: string;
  meta?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function canonicalLabel(type: string): string {
  switch (type) {
    case "absent_unexcused": return "Absent (unexcused)";
    case "absent_excused": return "Absent (excused)";
    case "absent_unverified": return "Absent (unverified)";
    case "tardy": return "Tardy";
    case "tardy_excused": return "Tardy (excused)";
    case "tardy_unexcused": return "Tardy (unexcused)";
    case "suspension_in_school": return "Suspension (in-school)";
    case "suspension_out_of_school": return "Suspension (out-of-school)";
    default: return type.replace(/_/g, " ");
  }
}

function canonicalIconColor(type: string): TimelineEvent["icon"] {
  if (type.startsWith("absent_unexcused") || type.startsWith("absent_unverified")) return "red";
  if (type.startsWith("absent_excused")) return "amber";
  if (type.startsWith("suspension")) return "red";
  return "slate";
}

function formatMethodLabel(method: string): string {
  switch (method) {
    case "certified_mail": return "Certified Mail";
    case "mail": return "Mail";
    case "hand_delivery": return "Hand Delivery";
    case "email": return "Email";
    default: return method?.replace(/_/g, " ") ?? "";
  }
}

function formatCompletionEvent(action: Action): { title: string; subtitle?: string } {
  const cd = action.completion_data;
  if (!cd) {
    return {
      title: `Action completed: ${action.title}`,
      subtitle: action.completion_notes ?? undefined,
    };
  }

  switch (action.action_type) {
    case "send_letter": {
      const date = cd.date_sent ? fmtShortDate(cd.date_sent as string) : "";
      const method = formatMethodLabel(cd.method as string);
      const tracking = cd.tracking_number ? ` (tracking #${cd.tracking_number})` : "";
      const legal = cd.legal_language_confirmed ? " — Legal language per EC §48260.5 confirmed" : "";
      return {
        title: `Tier 1 Notification Sent — ${date} via ${method}${tracking}`,
        subtitle: legal ? legal.slice(3) : undefined,
      };
    }
    case "schedule_conference": {
      const date = cd.conference_date ? fmtShortDate(cd.conference_date as string) : "";
      const statusLabel = (cd.status as string)?.replace(/_/g, " ") ?? "";
      const attendees = (cd.attendees as string[]) ?? [];
      const resources = (cd.resources_offered as string[]) ?? [];
      const parts: string[] = [];
      if (attendees.length > 0) parts.push(`Attendees: ${attendees.join(", ")}`);
      if (resources.length > 0) parts.push(`Resources: ${resources.join(", ")}`);
      if (cd.consequences_explained) parts.push("Consequences per EC §48262 noted");
      return {
        title: `Tier 2 Conference ${statusLabel} — ${date}`,
        subtitle: parts.join(" — ") || undefined,
      };
    }
    case "prepare_sarb_packet": {
      const dest = cd.referral_destination ? ` to ${cd.referral_destination}` : "";
      const sarbDate = cd.sarb_meeting_date ? ` — Hearing ${fmtShortDate(cd.sarb_meeting_date as string)}` : "";
      return {
        title: `SARB Packet Assembled${dest}${sarbDate}`,
        subtitle: cd.all_items_complete ? "All packet items verified complete" : undefined,
      };
    }
    case "follow_up_call": {
      const date = cd.contact_date ? fmtShortDate(cd.contact_date as string) : "";
      const outcome = (cd.contact_outcome as string)?.replace(/_/g, " ") ?? "";
      return {
        title: `Follow-up: ${outcome} — ${date}`,
        subtitle: action.completion_notes ?? undefined,
      };
    }
    default:
      return {
        title: `Action completed: ${action.title}`,
        subtitle: action.completion_notes ?? undefined,
      };
  }
}

/* ------------------------------------------------------------------ */
/* buildTimeline                                                       */
/* ------------------------------------------------------------------ */

function buildTimeline(
  absences: AttendanceRecord[],
  complianceCases: ComplianceCase[],
  actions: Action[],
  interventions: InterventionEntry[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Absences: collapse consecutive runs
  const sorted = [...absences].sort((a, b) => a.calendar_date.localeCompare(b.calendar_date));
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    const startType = start.canonical_type;
    let end = start;
    let count = 1;

    while (i + count < sorted.length) {
      const next = sorted[i + count];
      const prevDate = new Date(sorted[i + count - 1].calendar_date + "T00:00:00");
      const nextDate = new Date(next.calendar_date + "T00:00:00");
      const diffDays = (nextDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 3 && next.canonical_type === startType) {
        end = next;
        count++;
      } else {
        break;
      }
    }

    const iconColor = canonicalIconColor(startType);
    if (count >= 3) {
      events.push({
        id: `abs-${start.id}`,
        date: end.calendar_date,
        type: "absence",
        icon: iconColor,
        title: `${canonicalLabel(startType)} ${count} consecutive days (${fmtShortDate(start.calendar_date)}–${fmtShortDate(end.calendar_date)})`,
        subtitle: start.sis_absence_code ? `Code: ${start.sis_absence_code}` : undefined,
      });
    } else {
      for (let j = 0; j < count; j++) {
        const rec = sorted[i + j];
        events.push({
          id: `abs-${rec.id}`,
          date: rec.calendar_date,
          type: "absence",
          icon: canonicalIconColor(rec.canonical_type),
          title: canonicalLabel(rec.canonical_type),
          subtitle: rec.sis_absence_code ? `Code: ${rec.sis_absence_code}` : undefined,
        });
      }
    }
    i += count;
  }

  // Compliance case events
  for (const c of complianceCases) {
    events.push({
      id: `comp-created-${c.id}`,
      date: c.created_at.slice(0, 10),
      type: "compliance",
      icon: "red-filled",
      title: `Compliance case opened — ${TIER_LABELS[c.current_tier] ?? c.current_tier}`,
      subtitle: `${c.unexcused_absence_count} unexcused absences, ${c.truancy_count} truancy count`,
    });
    if (c.tier_2_triggered_at) {
      events.push({
        id: `comp-t2-${c.id}`,
        date: c.tier_2_triggered_at.slice(0, 10),
        type: "compliance",
        icon: "red-filled",
        title: "Case escalated to Tier 2 — Parent Conference",
      });
    }
    if (c.tier_3_triggered_at) {
      events.push({
        id: `comp-t3-${c.id}`,
        date: c.tier_3_triggered_at.slice(0, 10),
        type: "compliance",
        icon: "red-filled",
        title: "Case escalated to Tier 3 — SARB Referral",
      });
    }
  }

  // Actions
  for (const a of actions) {
    events.push({
      id: `act-created-${a.id}`,
      date: a.created_at.slice(0, 10),
      type: "action_created",
      icon: "blue",
      title: `Action created: ${a.title}`,
      subtitle: a.reason ?? undefined,
      meta: `Due ${fmtShortDate(a.due_date)}`,
    });
    if (a.status === "completed" && a.completed_at) {
      const fmt = formatCompletionEvent(a);
      events.push({
        id: `act-done-${a.id}`,
        date: a.completed_at.slice(0, 10),
        type: "action_completed",
        icon: "emerald",
        title: fmt.title,
        subtitle: fmt.subtitle,
      });
    }
  }

  // Interventions
  for (const iv of interventions) {
    events.push({
      id: `int-${iv.id}`,
      date: iv.intervention_date,
      type: "intervention",
      icon: "purple",
      title: `Intervention: ${iv.intervention_type.replace(/_/g, " ")}`,
      subtitle: iv.description ?? undefined,
      meta: iv.performed_by_name ? `by ${iv.performed_by_name}` : undefined,
    });
  }

  events.sort((a, b) => b.date.localeCompare(a.date));
  return events;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const ICON_COLORS: Record<TimelineEvent["icon"], string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  slate: "bg-slate-400",
  "red-filled": "bg-red-600",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  purple: "bg-purple-500",
};

const TIMELINE_ICONS: Record<TimelineEvent["type"], typeof AlertCircle> = {
  absence: AlertCircle,
  compliance: FileText,
  action_created: ClipboardList,
  action_completed: ClipboardCheck,
  intervention: Phone,
};

const FILTER_TO_TYPE: Record<TimelineFilter, TimelineEvent["type"][]> = {
  all: [],
  absences: ["absence"],
  compliance: ["compliance"],
  actions: ["action_created", "action_completed"],
  interventions: ["intervention"],
};

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "absences", label: "Absences" },
  { key: "compliance", label: "Compliance" },
  { key: "actions", label: "Actions" },
  { key: "interventions", label: "Interventions" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function StudentHistoryTimeline({
  absences,
  complianceCases,
  actions,
  interventions,
}: {
  absences: AttendanceRecord[];
  complianceCases: ComplianceCase[];
  actions: Action[];
  interventions: InterventionEntry[];
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [visibleCount, setVisibleCount] = useState(30);

  const allEvents = useMemo(
    () => buildTimeline(absences, complianceCases, actions, interventions),
    [absences, complianceCases, actions, interventions]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return allEvents;
    const types = FILTER_TO_TYPE[filter];
    return allEvents.filter((e) => types.includes(e.type));
  }, [allEvents, filter]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">History</h2>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setVisibleCount(30); }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-sm text-slate-400">No events to display</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />

          <div className="space-y-1">
            {visible.map((event) => {
              const Icon = TIMELINE_ICONS[event.type];
              return (
                <div key={event.id} className="relative flex items-start gap-4 pl-0">
                  <div className="relative z-10 flex items-center justify-center w-[31px] shrink-0">
                    <div className={cn("w-[9px] h-[9px] rounded-full ring-2 ring-white", ICON_COLORS[event.icon])} />
                  </div>
                  <div className="flex-1 bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-2.5 min-w-0 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700">{event.title}</p>
                          {event.subtitle && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{event.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {event.meta && (
                          <span className="text-xs text-slate-400">{event.meta}</span>
                        )}
                        <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                          {fmtShortDate(event.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 30)}
              className="mt-3 ml-[39px] text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Load {Math.min(30, filtered.length - visibleCount)} more events
            </button>
          )}
        </div>
      )}
    </div>
  );
}
