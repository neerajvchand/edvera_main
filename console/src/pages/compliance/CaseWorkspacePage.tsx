import { useParams } from "react-router-dom";
import { useCaseWorkspace } from "@/hooks/useCaseWorkspace";
import { CaseWorkspaceHeader } from "@/components/compliance/workspace/CaseWorkspaceHeader";
import { WorkflowStepsCard } from "@/components/compliance/workspace/WorkflowStepsCard";
import { StudentSummaryCard } from "@/components/compliance/workspace/StudentSummaryCard";
import { TimelineCard } from "@/components/compliance/workspace/TimelineCard";
import { OpenActionsCard } from "@/components/compliance/workspace/OpenActionsCard";
import { DocumentsCard } from "@/components/compliance/workspace/DocumentsCard";
import { SarbPacketCard } from "@/components/compliance/workspace/SarbPacketCard";

import { CaseResolutionCard } from "@/components/compliance/workspace/CaseResolutionCard";
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
          <WorkflowStepsCard data={data} onRefresh={refetch} />
          <OpenActionsCard
            actions={data.actions}
            caseId={data.case.id}
            tierChecklist={data.tierChecklist}
            hasSartMeeting={!!data.sartMeeting}
            hasSartFollowup={!!data.sartFollowup}
            onActionCompleted={refetch}
          />
          <DocumentsCard
            caseId={data.case.id}
            documents={data.documents}
            workspaceData={data}
            permissions={data.permissions}
            onDocumentGenerated={refetch}
          />
          <SarbPacketCard
            caseId={data.case.id}
            workspaceData={data}
            permissions={data.permissions}
            onRefresh={refetch}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <StudentSummaryCard
            metrics={data.metrics}
            caseData={data.case}
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
    </div>
  );
}
