import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Mail,
  Phone,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
} from "lucide-react";
import type { ActionItem, CaseWorkspaceResponse } from "@/types/caseWorkspace";
import { ActionCompletionModal } from "./ActionCompletionModal";
import { useCompleteAction } from "@/hooks/useCompleteAction";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function actionIcon(type: string) {
  if (
    ["send_truancy_letter", "truancy_notification", "send_notification_letter", "send_letter"].includes(type)
  )
    return Mail;
  if (
    ["followup_call", "follow_up_call", "follow_up_contact", "phone_call"].includes(type)
  )
    return Phone;
  if (
    ["schedule_conference", "parent_guardian_conference", "conference"].includes(type)
  )
    return Users;
  if (
    ["prepare_sarb_packet", "sarb_referral", "sarb_packet"].includes(type)
  )
    return FileText;
  return ClipboardList;
}

const TIER_2_ACTION_TYPES = [
  "followup_call",
  "follow_up_call",
  "follow_up_contact",
  "phone_call",
  "schedule_conference",
  "parent_guardian_conference",
  "conference",
];

const TIER_3_ACTION_TYPES = [
  "prepare_sarb_packet",
  "sarb_referral",
  "sarb_packet",
];

const PRIORITY_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  urgent: { bg: "bg-red-50", text: "text-red-600", label: "Urgent" },
  high: { bg: "bg-orange-50", text: "text-orange-600", label: "High" },
  medium: { bg: "bg-yellow-50", text: "text-yellow-600", label: "Medium" },
  low: { bg: "bg-gray-50", text: "text-gray-500", label: "Low" },
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns a list of human-readable reasons why this action is blocked,
 * or an empty array if the action can be completed.
 */
function getBlockingReasons(
  actionType: string,
  tierChecklist: CaseWorkspaceResponse["tierChecklist"],
): string[] {
  const t1NotifSent = tierChecklist.tier1.find(
    (i) => i.key === "notification_sent"
  );
  const t2ConfHeld = tierChecklist.tier2.find(
    (i) => i.key === "conference_held"
  );

  // Tier 1 actions (send_letter) — no prerequisites, always available
  // Tier 2 actions — require Tier 1 notification sent
  if (TIER_2_ACTION_TYPES.includes(actionType)) {
    const missing: string[] = [];
    if (!t1NotifSent?.completed) {
      missing.push("Tier 1 notification letter must be sent first (EC §48260.5)");
    }
    return missing;
  }

  // Tier 3 actions — require Tier 1 notification + Tier 2 conference
  if (TIER_3_ACTION_TYPES.includes(actionType)) {
    const missing: string[] = [];
    if (!t1NotifSent?.completed) {
      missing.push("Tier 1 notification letter has not been sent");
    }
    if (!t2ConfHeld?.completed) {
      missing.push("Tier 2 parent/guardian conference has not been held");
    }
    if (missing.length > 0) {
      missing.push("EC §48263 requires prior tier documentation before SARB referral");
    }
    return missing;
  }

  return [];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  actions: ActionItem[];
  caseId: string;
  tierChecklist: CaseWorkspaceResponse["tierChecklist"];
  onActionCompleted: () => void;
}

export function OpenActionsCard({
  actions,
  caseId,
  tierChecklist,
  onActionCompleted,
}: Props) {
  const [completingAction, setCompletingAction] = useState<ActionItem | null>(
    null
  );
  const { complete, isSubmitting, error } = useCompleteAction(
    caseId,
    () => {
      setCompletingAction(null);
      onActionCompleted();
    }
  );

  const count = actions.length;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-2 bg-blue-50">
              <ClipboardList className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              Open Actions ({count})
            </h3>
          </div>
        </div>

        {count > 0 ? (
          <div className="space-y-2">
            {actions.map((action) => {
              const Icon = actionIcon(action.type);
              const priority = PRIORITY_STYLES[action.priority] ?? PRIORITY_STYLES.medium;
              const overdue = isOverdue(action.dueDate);
              const blockingReasons = getBlockingReasons(action.type, tierChecklist);
              const isBlocked = blockingReasons.length > 0;

              return (
                <div
                  key={action.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    isBlocked
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  {/* Icon */}
                  <div className="shrink-0 mt-0.5 rounded-lg p-1.5 bg-gray-50">
                    <Icon className={cn("h-4 w-4", isBlocked ? "text-gray-300" : "text-gray-500")} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isBlocked ? "text-gray-400" : "text-gray-900"
                    )}>
                      {action.title}
                    </p>
                    {action.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {action.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          priority.bg,
                          priority.text
                        )}
                      >
                        {priority.label}
                      </span>
                      {action.dueDate && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[10px]",
                            overdue ? "text-red-500 font-medium" : "text-gray-400"
                          )}
                        >
                          {overdue ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {formatDate(action.dueDate)}
                        </span>
                      )}
                    </div>

                    {/* Prerequisite blocking reasons */}
                    {isBlocked && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                          <Lock className="h-3 w-3 shrink-0" />
                          Prerequisites not met:
                        </p>
                        {blockingReasons.map((reason, idx) => (
                          <p key={idx} className="text-xs text-amber-600 ml-4">
                            &bull; {reason}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Complete button — only shown when prerequisites are met */}
                  {!isBlocked && (
                    <button
                      onClick={() => setCompletingAction(action)}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-4 justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <p className="text-sm text-emerald-600 font-medium">
              No open actions — all tasks complete
            </p>
          </div>
        )}
      </div>

      {/* Completion Modal */}
      {completingAction && (
        <ActionCompletionModal
          action={completingAction}
          caseId={caseId}
          isOpen={!!completingAction}
          onClose={() => setCompletingAction(null)}
          onSubmit={complete}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </>
  );
}
