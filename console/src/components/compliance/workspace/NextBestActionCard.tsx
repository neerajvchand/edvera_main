/**
 * NextBestActionCard — the most prominent element in the case workspace.
 *
 * Shows one clear action at a time based on the case's current stage.
 * Delegates logic to getNextBestAction() pure function.
 * Surfaces overdue actions before the normal workflow action.
 */

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { CaseWorkflowStage, PacketStage } from "@/lib/caseStages";
import type { ActionItem, CaseWorkspaceResponse } from "@/types/caseWorkspace";
import { getNextBestAction, type NextBestAction } from "@/lib/nextBestAction";

/* ------------------------------------------------------------------ */
/* CTA Button Labels — customised per actionType                       */
/* ------------------------------------------------------------------ */

const CTA_LABELS: Record<NextBestAction["actionType"], string> = {
  review_data: "Mark as Reviewed",
  assign_owner: "Assign Owner",
  log_outreach: "Log Contact",
  schedule_followup: "Log Contact",
  complete_barrier_assessment: "Complete Assessment",
  log_intervention: "Log Intervention",
  send_tier1_letter: "Generate Letter",
  schedule_conference: "View Open Actions",
  begin_packet: "Begin Packet",
  complete_packet: "Submit for Review",
  waiting_approval: "Review Packet",
  submit_packet: "Mark Submitted",
  record_hearing: "Record Hearing",
  enter_monitoring: "Enter Monitoring",
  none: "Continue",
};

/* ------------------------------------------------------------------ */
/* Overdue Action Helper                                               */
/* ------------------------------------------------------------------ */

function getOverdueActions(actions: ActionItem[]): ActionItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return actions.filter(
    (a) =>
      a.status === "open" &&
      a.dueDate &&
      a.dueDate < today
  );
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  caseWorkflowStage: CaseWorkflowStage;
  packetStage: PacketStage;
  tierChecklist: CaseWorkspaceResponse["tierChecklist"];
  rootCause: CaseWorkspaceResponse["rootCause"];
  permissions: CaseWorkspaceResponse["permissions"];
  actions?: ActionItem[];
  onAction: (actionType: NextBestAction["actionType"]) => void;
}

export function NextBestActionCard({
  caseWorkflowStage,
  packetStage,
  tierChecklist,
  rootCause,
  permissions,
  actions,
  onAction,
}: Props) {
  const tier1Complete =
    tierChecklist.tier1.find((i) => i.key === "notification_sent")?.completed ?? false;
  const tier2Complete =
    tierChecklist.tier2.find((i) => i.key === "conference_held")?.completed ?? false;
  const rootCauseComplete = rootCause?.status === "complete" ?? false;

  const action = getNextBestAction({
    caseWorkflowStage,
    packetStage,
    tier1Complete,
    tier2Complete,
    rootCauseComplete,
    permissions,
  });

  const overdueActions = actions ? getOverdueActions(actions) : [];
  const hasOverdue = overdueActions.length > 0;

  // Closed case — subtle state
  if (!action) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Next Step
        </p>
        <div className="flex items-center gap-2 text-gray-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-base font-medium">Case closed</span>
        </div>
      </div>
    );
  }

  // Waiting state — no CTA button
  if (action.actionType === "waiting_approval" && !action.urgent) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Next Step
        </p>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {action.title}
        </h3>
        <p className="text-sm text-gray-500">{action.description}</p>
      </div>
    );
  }

  const ctaLabel = CTA_LABELS[action.actionType] ?? action.title;

  // Standard action card with CTA
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm p-6",
        (action.urgent || hasOverdue) && "border-l-4 border-l-amber-400"
      )}
    >
      {/* Overdue warning banner */}
      {hasOverdue && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs font-medium text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {overdueActions.length} overdue action{overdueActions.length !== 1 ? "s" : ""} need attention
          </p>
        </div>
      )}

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Next Step
      </p>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {action.title}
      </h3>
      <p className="text-sm text-gray-500 mb-4">{action.description}</p>
      <button
        onClick={() => onAction(action.actionType)}
        className={cn(
          "w-full py-3 text-sm font-medium text-white rounded-lg transition-colors",
          action.urgent
            ? "bg-red-600 hover:bg-red-700"
            : "bg-emerald-600 hover:bg-emerald-700"
        )}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
