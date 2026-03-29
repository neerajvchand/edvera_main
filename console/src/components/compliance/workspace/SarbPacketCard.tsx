/**
 * SARB Packet Card — Chunk 3
 *
 * Modes: not_started, draft, ready_for_approval, approved, submitted
 * Uses SarbPacketWizard for packet assembly.
 * Shows readiness checklist, county office info, and approval status.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Package,
  CheckCircle2,
  Circle,
  Clock,
  Shield,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Lock,
  Loader2,
} from "lucide-react";
import { submitSarbForApproval, markSarbSubmitted } from "@/services/compliance/updateCase";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";
import { SarbPacketWizard } from "@/components/compliance/sarb-packet/SarbPacketWizard";
import { PACKET_STAGE_CONFIG, type PacketStage } from "@/lib/caseStages";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  workspaceData: CaseWorkspaceResponse;
  permissions: CaseWorkspaceResponse["permissions"];
  onRefresh: () => void;
}

/* ------------------------------------------------------------------ */
/* Readiness Checklist                                                 */
/* ------------------------------------------------------------------ */

interface ReadinessItem {
  key: string;
  label: string;
  completed: boolean;
}

function getReadinessChecklist(
  tierChecklist: CaseWorkspaceResponse["tierChecklist"],
  rootCause: CaseWorkspaceResponse["rootCause"],
  documents: CaseWorkspaceResponse["documents"]
): ReadinessItem[] {
  const t1Notif = tierChecklist.tier1.find((i) => i.key === "notification_sent");
  const t2Conf = tierChecklist.tier2.find((i) => i.key === "conference_held");
  const hasLetter = documents.some((d) => d.docType === "tier1_notification");
  const hasConferenceSummary = documents.some((d) => d.docType === "tier2_conference_summary");
  const rootCauseComplete = rootCause?.status === "complete";

  return [
    { key: "t1_letter", label: "Tier 1 notification letter sent", completed: !!t1Notif?.completed },
    { key: "t1_doc", label: "Tier 1 letter generated", completed: hasLetter },
    { key: "t2_conference", label: "Tier 2 conference held", completed: !!t2Conf?.completed },
    { key: "t2_summary", label: "Conference summary generated", completed: hasConferenceSummary },
    { key: "root_cause", label: "Root cause analysis complete", completed: rootCauseComplete },
  ];
}

/* ------------------------------------------------------------------ */
/* Status display                                                      */
/* ------------------------------------------------------------------ */

const PACKET_ICONS: Record<PacketStage, typeof CheckCircle2> = {
  not_started: Circle,
  draft: Clock,
  generated: Shield,
  under_review: Shield,
  approved: CheckCircle2,
  submitted: CheckCircle2,
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SarbPacketCard({
  caseId,
  workspaceData,
  permissions,
  onRefresh,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const c = workspaceData.case;
  const mode = c.packetStage;
  const statusCfg = PACKET_STAGE_CONFIG[mode] ?? PACKET_STAGE_CONFIG.not_started;
  const StatusIcon = PACKET_ICONS[mode] ?? PACKET_ICONS.not_started;
  const readiness = getReadinessChecklist(
    workspaceData.tierChecklist,
    workspaceData.rootCause,
    workspaceData.documents
  );
  const allReady = readiness.every((r) => r.completed);
  const completedCount = readiness.filter((r) => r.completed).length;
  const countyOffice = workspaceData.countyOffice;

  // Tier gate check — both Tier 1 and 2 must be complete
  const t1Done = workspaceData.tierChecklist.tier1.find((i) => i.key === "notification_sent")?.completed;
  const t2Done = workspaceData.tierChecklist.tier2.find((i) => i.key === "conference_held")?.completed;
  const tierGateOpen = !!t1Done && !!t2Done;

  // Build the CaseDetailForModal shape from workspace data
  function buildModalProps() {
    return {
      id: c.id,
      student_id: c.studentId,
      school_id: c.schoolId,
      district_id: c.districtId,
      academic_year: "2025-2026",
      current_tier: c.tier === 3 ? "tier_3_sarb_referral" : c.tier === 2 ? "tier_2_conference" : "tier_1_letter",
      tier_requirements: {},
      root_cause_data: workspaceData.rootCauseData ?? {},
      sarb_packet_status: c.sarbPacketStatus,
      unexcused_absence_count: workspaceData.metrics.unexcusedAbsences,
      truancy_count: workspaceData.metrics.truancyCount,
      total_absence_count: workspaceData.metrics.totalAbsences,
      created_at: c.openedAt,
      student_name: c.studentName,
      student_first_name: c.studentName.split(" ")[0] ?? "",
      student_last_name: c.studentName.split(" ").slice(1).join(" ") || "",
      student_grade: c.grade,
      student_dob: c.dateOfBirth,
      school_name: c.schoolName,
    };
  }

  async function handleSubmitForApproval() {
    setSubmitting(true);
    try {
      await submitSarbForApproval(caseId);
      onRefresh();
    } catch (err) {
      console.error("Failed to submit for approval:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkSubmitted() {
    setSubmitting(true);
    try {
      await markSarbSubmitted(caseId);
      onRefresh();
    } catch (err) {
      console.error("Failed to mark submitted:", err);
    } finally {
      setSubmitting(false);
    }
  }

  // Not at Tier 3 — show locked state
  if (c.tier < 3) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-lg p-2 bg-gray-50">
            <Package className="h-4 w-4 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-500">
            SARB Packet
          </h3>
        </div>
        <p className="text-sm text-gray-400">
          Available at Tier 3
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-2 bg-red-50">
              <Package className="h-4 w-4 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              SARB Packet
            </h3>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
              statusCfg.bg,
              statusCfg.text
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </span>
        </div>

        {/* Tier gate warning */}
        {!tierGateOpen && (
          <div className="mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Tier 1 notification and Tier 2 conference must be completed before SARB referral (EC §48263)
            </p>
          </div>
        )}

        {/* Readiness checklist */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Readiness Checklist
            </h4>
            <span className="text-xs text-gray-400 tabular-nums">
              {completedCount}/{readiness.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {readiness.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                {item.completed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                )}
                <span
                  className={cn(
                    "text-xs",
                    item.completed ? "text-gray-700" : "text-gray-400"
                  )}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* County office info */}
        {countyOffice && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              SARB Coordinator
            </h4>
            <div className="space-y-1.5">
              <p className="text-sm text-gray-900 font-medium">
                {countyOffice.name}
              </p>
              {countyOffice.sarbCoordinatorName && (
                <p className="text-xs text-gray-600">
                  {countyOffice.sarbCoordinatorName}
                </p>
              )}
              {countyOffice.sarbCoordinatorEmail && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {countyOffice.sarbCoordinatorEmail}
                </p>
              )}
              {countyOffice.sarbCoordinatorPhone && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {countyOffice.sarbCoordinatorPhone}
                </p>
              )}
              {countyOffice.sarbMeetingLocation && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {countyOffice.sarbMeetingLocation}
                </p>
              )}
              {countyOffice.sarbMeetingSchedule && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {countyOffice.sarbMeetingSchedule}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Approval info */}
        {workspaceData.sarbApproval && (
          <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Approved{workspaceData.sarbApproval.approvedAt
                ? ` on ${new Date(workspaceData.sarbApproval.approvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}
            </p>
            {workspaceData.sarbApproval.notes && (
              <p className="text-xs text-emerald-600 mt-1">
                {workspaceData.sarbApproval.notes}
              </p>
            )}
          </div>
        )}

        {/* Action buttons based on mode */}
        <div className="flex flex-col gap-2">
          {mode === "not_started" && tierGateOpen && permissions.canSubmitSarb && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Begin Packet Assembly
            </button>
          )}

          {mode === "draft" && permissions.canSubmitSarb && (
            <>
              <button
                onClick={() => setShowModal(true)}
                className="w-full px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                Continue Editing
              </button>
              {allReady && (
                <button
                  onClick={handleSubmitForApproval}
                  disabled={submitting}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit for Principal Approval
                </button>
              )}
            </>
          )}

          {mode === "under_review" && (
            <div className="text-center py-2">
              <p className="text-sm text-blue-600 font-medium">
                Awaiting principal approval
              </p>
              <p className="text-xs text-gray-400 mt-1">
                The principal will review and approve before submission to SARB
              </p>
            </div>
          )}

          {mode === "approved" && permissions.canSubmitSarb && (
            <button
              onClick={handleMarkSubmitted}
              disabled={submitting}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark as Submitted to SARB
            </button>
          )}

          {mode === "submitted" && (
            <div className="text-center py-2">
              <p className="text-sm text-emerald-600 font-medium flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Packet submitted to SARB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SARB Packet Assembly Modal */}
      {showModal && (
        <SarbPacketWizard
          caseDetail={buildModalProps()}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
