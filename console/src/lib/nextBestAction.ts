/**
 * Next Best Action engine.
 *
 * Pure function — no DB calls, no side effects.
 * Given a case's current stage and checklist state, returns the single
 * most important action the operator should take next.
 */

import type { CaseWorkflowStage, PacketStage } from "@/lib/caseStages";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

export interface NextBestAction {
  title: string;
  description: string;
  actionType:
    | "review_data"
    | "assign_owner"
    | "log_outreach"
    | "schedule_followup"
    | "complete_barrier_assessment"
    | "log_intervention"
    | "send_tier1_letter"
    | "schedule_conference"
    | "begin_packet"
    | "complete_packet"
    | "waiting_approval"
    | "submit_packet"
    | "record_hearing"
    | "enter_monitoring"
    | "none";
  urgent: boolean;
}

export function getNextBestAction(params: {
  caseWorkflowStage: CaseWorkflowStage;
  packetStage: PacketStage;
  tier1Complete: boolean;
  tier2Complete: boolean;
  rootCauseComplete: boolean;
  permissions: CaseWorkspaceResponse["permissions"];
}): NextBestAction | null {
  const { caseWorkflowStage, packetStage, tier1Complete, tier2Complete, permissions } = params;

  switch (caseWorkflowStage) {
    case "closed":
      return null;

    case "new":
      return {
        title: "Review attendance data",
        description: "Confirm absence counts and open this case for tracking.",
        actionType: "review_data",
        urgent: false,
      };

    case "needs_review":
      return {
        title: "Assign case owner",
        description: "Assign a staff member responsible for this case.",
        actionType: "assign_owner",
        urgent: false,
      };

    case "outreach_in_progress":
      return {
        title: "Log family contact attempt",
        description: "Record your most recent contact with the family.",
        actionType: "log_outreach",
        urgent: false,
      };

    case "barrier_assessment":
      return {
        title: "Complete barrier assessment",
        description: "Document the root cause factors before scheduling a conference.",
        actionType: "complete_barrier_assessment",
        urgent: false,
      };

    case "intervention_active":
      return {
        title: "Log intervention outcome",
        description: "Record the result of the most recent intervention.",
        actionType: "log_intervention",
        urgent: false,
      };

    case "compliance_prep":
      return getCompliancePrepAction(packetStage, tier1Complete, tier2Complete, permissions);

    case "ready_for_board":
      return {
        title: "Record hearing result",
        description: "Enter the outcome from the SARB hearing.",
        actionType: "record_hearing",
        urgent: false,
      };

    case "monitoring_period":
      return {
        title: "Monitoring period active",
        description: "Attendance is improving. Review in 30 days to confirm sustained improvement before closing.",
        actionType: "none",
        urgent: false,
      };

    default:
      return null;
  }
}

function getCompliancePrepAction(
  packetStage: PacketStage,
  tier1Complete: boolean,
  tier2Complete: boolean,
  permissions: CaseWorkspaceResponse["permissions"]
): NextBestAction {
  if (!tier1Complete) {
    return {
      title: "Send Tier 1 notification letter",
      description: "Required by EC \u00A748260.5 before escalation.",
      actionType: "send_tier1_letter",
      urgent: true,
    };
  }

  if (!tier2Complete) {
    return {
      title: "Schedule Tier 2 conference",
      description: "Required parent conference before SARB referral (EC \u00A748262).",
      actionType: "schedule_conference",
      urgent: true,
    };
  }

  if (packetStage === "not_started") {
    return {
      title: "Begin SARB packet assembly",
      description: "All prerequisites met. Assemble the referral packet.",
      actionType: "begin_packet",
      urgent: false,
    };
  }

  if (packetStage === "draft") {
    return {
      title: "Complete and submit packet for review",
      description: "Finish the packet and send to principal for approval.",
      actionType: "complete_packet",
      urgent: false,
    };
  }

  if (packetStage === "generated") {
    return {
      title: "Submit packet for principal review",
      description: "Packet is ready. Send to principal for approval.",
      actionType: "complete_packet",
      urgent: false,
    };
  }

  if (packetStage === "under_review") {
    if (permissions.canApproveEscalation) {
      return {
        title: "Review and approve packet",
        description: "Packet is awaiting your approval before SARB submission.",
        actionType: "waiting_approval",
        urgent: true,
      };
    }
    return {
      title: "Awaiting principal approval",
      description: "No action needed \u2014 waiting for principal review.",
      actionType: "waiting_approval",
      urgent: false,
    };
  }

  if (packetStage === "approved") {
    return {
      title: "Submit packet to SARB board",
      description: "Approved and ready for submission.",
      actionType: "submit_packet",
      urgent: false,
    };
  }

  if (packetStage === "submitted") {
    return {
      title: "Record hearing date and outcome",
      description: "Packet submitted. Record the scheduled hearing.",
      actionType: "record_hearing",
      urgent: false,
    };
  }

  return {
    title: "Review case status",
    description: "Check case progress and determine next steps.",
    actionType: "none",
    urgent: false,
  };
}
