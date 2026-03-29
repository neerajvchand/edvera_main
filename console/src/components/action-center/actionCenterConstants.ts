import {
  Mail,
  Phone,
  Users as UsersIcon,
  FileText,
  ClipboardList,
  TrendingUp,
  Clock,
  Minus,
  CheckCircle2,
} from "lucide-react";
import type { ActionListItem } from "@/types/action";

/* ------------------------------------------------------------------ */
/* Types — re-exported from canonical locations                        */
/* ------------------------------------------------------------------ */

export type ActionRow = ActionListItem;
export type { SchoolOption } from "@/services/actions/getActionList";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "deferred", label: "Deferred" },
];

export const TYPE_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "send_letter", label: "Send Letter" },
  { value: "follow_up_call", label: "Follow-up Call" },
  { value: "schedule_conference", label: "Conference" },
  { value: "prepare_sarb_packet", label: "SARB Packet" },
  { value: "review_case", label: "Review Case" },
  { value: "improvement_detected", label: "Improvement" },
  { value: "stale_case", label: "Stale Case" },
  { value: "plateau_detected", label: "Plateau" },
  { value: "monitoring_resolution", label: "Ready to Close" },
];

export const SORT_OPTIONS = [
  { value: "due_date_asc", label: "Due date (soonest)" },
  { value: "due_date_desc", label: "Due date (latest)" },
  { value: "priority_desc", label: "Priority (highest)" },
  { value: "created_at_desc", label: "Newest first" },
];

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  urgent: {
    label: "Urgent",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-l-red-500",
  },
  high: {
    label: "High",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-l-orange-400",
  },
  normal: {
    label: "Normal",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-l-slate-300",
  },
};

export const TYPE_ICONS: Record<string, typeof Mail> = {
  send_letter: Mail,
  follow_up_call: Phone,
  schedule_conference: UsersIcon,
  prepare_sarb_packet: FileText,
  review_case: ClipboardList,
  improvement_detected: TrendingUp,
  stale_case: Clock,
  plateau_detected: Minus,
  monitoring_resolution: CheckCircle2,
};

export const COMPLETION_OUTCOMES = [
  { value: "completed", label: "Completed successfully" },
  { value: "completed_no_response", label: "Completed \u2014 no response" },
  { value: "unable_to_complete", label: "Unable to complete" },
  { value: "deferred", label: "Deferred to later" },
];

export const PRIORITY_SORT_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function getDueDateInfo(dueDate: string): {
  label: string;
  color: string;
  isOverdue: boolean;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d overdue`,
      color: "text-red-600",
      isOverdue: true,
    };
  }
  if (diffDays === 0) {
    return { label: "Due today", color: "text-amber-600", isOverdue: false };
  }
  if (diffDays === 1) {
    return { label: "Due tomorrow", color: "text-amber-600", isOverdue: false };
  }
  if (diffDays <= 3) {
    return {
      label: `Due in ${diffDays}d`,
      color: "text-amber-600",
      isOverdue: false,
    };
  }
  return {
    label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    color: "text-gray-500",
    isOverdue: false,
  };
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
