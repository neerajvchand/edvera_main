import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import {
  PRIORITY_CONFIG,
  TYPE_ICONS,
  COMPLETION_OUTCOMES,
  getDueDateInfo,
  formatDate,
  type ActionRow,
} from "./actionCenterConstants";

export function ActionCard({ action }: { action: ActionRow }) {
  const priority = PRIORITY_CONFIG[action.priority] ?? PRIORITY_CONFIG.normal;
  const TypeIcon = TYPE_ICONS[action.action_type] ?? ClipboardList;
  const dueInfo = getDueDateInfo(action.due_date);
  const isCompleted = action.status === "completed";
  const isDeferred = action.status === "deferred";

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm border-l-4 transition-all duration-200 hover:shadow-md",
        isCompleted
          ? "border-l-emerald-400 opacity-75"
          : isDeferred
            ? "border-l-gray-300 opacity-75"
            : priority.border
      )}
    >
      <div className="p-4">
        {/* Top row: icon + title + priority */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "rounded-lg p-2 shrink-0 mt-0.5",
              isCompleted ? "bg-emerald-50" : "bg-gray-50"
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <TypeIcon className="h-4 w-4 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={cn(
                  "text-sm font-medium",
                  isCompleted
                    ? "text-gray-500 line-through"
                    : "text-gray-900"
                )}
              >
                {action.title}
              </h3>
              {!isCompleted && !isDeferred && (
                <span
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-full",
                    priority.bg,
                    priority.text
                  )}
                >
                  {priority.label}
                </span>
              )}
            </div>

            {/* Student + school */}
            <div className="flex items-center gap-2 mt-1">
              <Link
                to={`/student/${action.student_id}`}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
              >
                {action.student_name}
              </Link>
              <span className="text-xs text-gray-400">&middot;</span>
              <span className="text-xs text-gray-500">
                {action.school_name}
              </span>
            </div>

            {/* Reason */}
            {action.reason && !isCompleted && (
              <p className="text-xs text-gray-500 mt-1.5">{action.reason}</p>
            )}

            {/* Completion info */}
            {isCompleted && action.completion_outcome && (
              <p className="text-xs text-emerald-600 mt-1">
                {COMPLETION_OUTCOMES.find(
                  (o) => o.value === action.completion_outcome
                )?.label ?? action.completion_outcome}
              </p>
            )}
          </div>

          {/* Right side: due date + actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {!isCompleted && !isDeferred && (
              <div className="flex items-center gap-1">
                {dueInfo.isOverdue && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className={cn("text-xs font-medium", dueInfo.color)}>
                  {dueInfo.label}
                </span>
              </div>
            )}
            {isCompleted && (
              <span className="text-xs text-gray-400">
                {action.completed_at
                  ? formatDate(action.completed_at.slice(0, 10))
                  : "Completed"}
              </span>
            )}
            {isDeferred && (
              <span className="text-xs text-gray-400">Deferred</span>
            )}

            {action.compliance_case_id && (
              <Link
                to={`/compliance/cases/${action.compliance_case_id}`}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2.5 py-1 rounded-md hover:bg-emerald-50 transition-colors flex items-center gap-1"
              >
                View Case
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
