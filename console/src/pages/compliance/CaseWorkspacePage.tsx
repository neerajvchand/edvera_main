import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useCaseWorkspace } from "@/hooks/useCaseWorkspace";
import { CaseWorkspaceHeader } from "@/components/compliance/workspace/CaseWorkspaceHeader";
import { TierChecklistCard } from "@/components/compliance/workspace/TierChecklistCard";
import { StudentSummaryCard } from "@/components/compliance/workspace/StudentSummaryCard";
import { TimelineCard } from "@/components/compliance/workspace/TimelineCard";
import { OpenActionsCard } from "@/components/compliance/workspace/OpenActionsCard";
import { DocumentsCard } from "@/components/compliance/workspace/DocumentsCard";
import { SarbPacketCard } from "@/components/compliance/workspace/SarbPacketCard";
import { NextBestActionCard } from "@/components/compliance/workspace/NextBestActionCard";
import { RootCauseCard } from "@/components/compliance/workspace/RootCauseCard";
import { CaseResolutionCard } from "@/components/compliance/workspace/CaseResolutionCard";
import { AssignOwnerModal } from "@/components/compliance/workspace/AssignOwnerModal";
import { LogOutreachModal } from "@/components/compliance/workspace/LogOutreachModal";
import { SarbApprovalModal } from "@/components/compliance/workspace/SarbApprovalModal";
import { RecordHearingModal } from "@/components/compliance/workspace/RecordHearingModal";
import { advanceCaseWorkflowStage, updateCaseFields } from "@/services/compliance/updateCase";
import { submitSarbForApproval, markSarbSubmitted } from "@/services/compliance/updateCase";
import type { NextBestAction } from "@/lib/nextBestAction";
import { AlertTriangle } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Loading Skeleton                                                    */
/* ------------------------------------------------------------------ */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`bg-gray-100 rounded-xl animate-pulse ${className ?? ""}`}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <SkeletonBlock className="h-4 w-36 mb-3 rounded-lg" />
        <SkeletonBlock className="h-8 w-72 mb-2 rounded-lg" />
        <SkeletonBlock className="h-4 w-96 mb-3 rounded-lg" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-7 w-16 rounded-full" />
          <SkeletonBlock className="h-7 w-20 rounded-full" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-32" />
        </div>
        {/* Right column */}
        <div className="space-y-6">
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-32" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error State                                                         */
/* ------------------------------------------------------------------ */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-full bg-red-50 p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Failed to load case
        </h2>
        <p className="text-sm text-gray-500 mb-4 max-w-sm">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page                                                           */
/* ------------------------------------------------------------------ */

export function CaseWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { data, isLoading, error, refetch } = useCaseWorkspace(caseId ?? "");

  /* ---- Modal state ---- */
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [showLogOutreach, setShowLogOutreach] = useState(false);
  const [showSarbApproval, setShowSarbApproval] = useState(false);
  const [showRecordHearing, setShowRecordHearing] = useState(false);

  /* ---- Next Best Action handler map ---- */
  const handleNextBestAction = useCallback(
    async (actionType: NextBestAction["actionType"]) => {
      if (!data) return;
      const id = data.case.id;

      switch (actionType) {
        /* Simple stage advances (no modal) */
        case "review_data":
          await advanceCaseWorkflowStage(id, "needs_review");
          refetch();
          break;

        /* Opens modal */
        case "assign_owner":
          setShowAssignOwner(true);
          break;

        /* Opens modal */
        case "log_outreach":
        case "schedule_followup":
          setShowLogOutreach(true);
          break;

        /* Simple stage advance */
        case "complete_barrier_assessment":
          await advanceCaseWorkflowStage(id, "intervention_active");
          refetch();
          break;

        /* Simple stage advance */
        case "log_intervention":
          await advanceCaseWorkflowStage(id, "compliance_prep");
          refetch();
          break;

        /* Tier 1 letter: scroll to Documents card (letter generation) */
        case "send_tier1_letter": {
          const docsEl = document.getElementById("documents-card");
          if (docsEl) docsEl.scrollIntoView({ behavior: "smooth" });
          break;
        }

        /* Tier 2 conference: scroll to Open Actions card */
        case "schedule_conference": {
          const actionsEl = document.getElementById("open-actions-card");
          if (actionsEl) actionsEl.scrollIntoView({ behavior: "smooth" });
          break;
        }

        /* SARB packet: scroll to SARB card */
        case "begin_packet": {
          const sarbEl = document.getElementById("sarb-packet-card");
          if (sarbEl) sarbEl.scrollIntoView({ behavior: "smooth" });
          break;
        }

        /* Submit packet for review */
        case "complete_packet":
          await submitSarbForApproval(id);
          refetch();
          break;

        /* Principal approval modal */
        case "waiting_approval":
          setShowSarbApproval(true);
          break;

        /* Submit approved packet to SARB */
        case "submit_packet":
          await markSarbSubmitted(id);
          refetch();
          break;

        /* Record hearing result */
        case "record_hearing":
          setShowRecordHearing(true);
          break;

        /* Enter monitoring period (attendance improved, observe 30-60 days) */
        case "enter_monitoring":
          await advanceCaseWorkflowStage(id, "monitoring_period");
          await updateCaseFields(id, { monitoring_started_at: new Date().toISOString() });
          refetch();
          break;

        default:
          refetch();
      }
    },
    [data, refetch]
  );

  /* ---- Modal close helpers (close + refetch) ---- */
  const closeAndRefetch = useCallback(
    (setter: (v: boolean) => void) => () => {
      setter(false);
      refetch();
    },
    [refetch]
  );

  if (isLoading || !data) {
    if (error) {
      return <ErrorState message={error} onRetry={refetch} />;
    }
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <CaseWorkspaceHeader data={data} onRefresh={refetch} />

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <NextBestActionCard
            caseId={data.case.id}
            caseWorkflowStage={data.case.caseWorkflowStage}
            packetStage={data.case.packetStage}
            tierChecklist={data.tierChecklist}
            rootCause={data.rootCause}
            permissions={data.permissions}
            actions={data.actions}
            onAction={handleNextBestAction}
          />
          <TierChecklistCard
            tierChecklist={data.tierChecklist}
            currentTier={data.case.tier}
          />
          <div id="open-actions-card">
            <OpenActionsCard
              actions={data.actions}
              caseId={data.case.id}
              tierChecklist={data.tierChecklist}
              onActionCompleted={refetch}
            />
          </div>
          <div id="documents-card">
            <DocumentsCard
              caseId={data.case.id}
              documents={data.documents}
              workspaceData={data}
              permissions={data.permissions}
              onDocumentGenerated={refetch}
            />
          </div>
          <div id="sarb-packet-card">
            <SarbPacketCard
              caseId={data.case.id}
              workspaceData={data}
              permissions={data.permissions}
              onRefresh={refetch}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <StudentSummaryCard
            metrics={data.metrics}
            caseData={data.case}
          />
          <RootCauseCard
            caseId={data.case.id}
            rootCause={data.rootCause}
            rootCauseData={data.rootCauseData}
            onSaved={refetch}
          />
          <TimelineCard timeline={data.timeline} />
          <CaseResolutionCard
            caseId={data.case.id}
            workspaceData={data}
            permissions={data.permissions}
            onResolved={refetch}
          />
        </div>
      </div>

      {/* ------ Modals ------ */}
      <AssignOwnerModal
        isOpen={showAssignOwner}
        caseId={data.case.id}
        schoolId={data.case.schoolId}
        onClose={() => setShowAssignOwner(false)}
        onAssigned={closeAndRefetch(setShowAssignOwner)}
      />
      <LogOutreachModal
        isOpen={showLogOutreach}
        caseId={data.case.id}
        studentId={data.case.studentId}
        schoolId={data.case.schoolId}
        onClose={() => setShowLogOutreach(false)}
        onLogged={closeAndRefetch(setShowLogOutreach)}
      />
      <SarbApprovalModal
        isOpen={showSarbApproval}
        caseId={data.case.id}
        onClose={() => setShowSarbApproval(false)}
        onCompleted={closeAndRefetch(setShowSarbApproval)}
      />
      <RecordHearingModal
        isOpen={showRecordHearing}
        caseId={data.case.id}
        onClose={() => setShowRecordHearing(false)}
        onRecorded={closeAndRefetch(setShowRecordHearing)}
      />
    </div>
  );
}
