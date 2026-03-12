/**
 * WorkflowStepsCard — 8-step collapsible workflow tracker.
 *
 * - complete → green checkmark with who + when, collapsed
 * - active  → expanded with the step's form
 * - locked  → lock icon with blocking reasons
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Lock, ChevronDown, ChevronRight, Shield } from "lucide-react";
import type { CaseWorkspaceResponse, WorkflowStep } from "@/types/caseWorkspace";

import { RootCauseStep } from "./steps/RootCauseStep";
import { SartReferralStep } from "./steps/SartReferralStep";
import { SartMeetingStep } from "./steps/SartMeetingStep";
import { SartActionPlanStep } from "./steps/SartActionPlanStep";
import { SartFollowupStep } from "./steps/SartFollowupStep";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TIER_LABELS: Record<number, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
};

/* ------------------------------------------------------------------ */
/* Step row                                                            */
/* ------------------------------------------------------------------ */

function StepRow({
  step,
  stepNumber,
  expanded,
  onToggle,
  children,
}: {
  step: WorkflowStep;
  stepNumber: number;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const isComplete = step.status === "complete";
  const isActive = step.status === "active";
  const isLocked = step.status === "locked";

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        isComplete && "border-emerald-200 bg-emerald-50/50",
        isActive && "border-emerald-300 bg-white shadow-sm",
        isLocked && "border-gray-100 bg-gray-50/50",
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        disabled={isLocked}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left",
          isLocked && "cursor-default",
        )}
      >
        {/* Step indicator */}
        <div className="shrink-0">
          {isComplete ? (
            <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
            </div>
          ) : isActive ? (
            <div className="h-6 w-6 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-700">
                {stepNumber}
              </span>
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock className="h-3 w-3 text-gray-400" />
            </div>
          )}
        </div>

        {/* Label + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                isComplete && "text-emerald-800",
                isActive && "text-gray-900",
                isLocked && "text-gray-400",
              )}
            >
              {step.label}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {TIER_LABELS[step.tier]}
            </span>
          </div>
          {isComplete && step.completedBy && step.completedAt && (
            <p className="text-xs text-emerald-600 mt-0.5">
              {step.completedBy} · {formatDate(step.completedAt)}
            </p>
          )}
        </div>

        {/* Chevron (not for locked) */}
        {!isLocked && (
          <div className="shrink-0 text-gray-400">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </button>

      {/* Blocking reasons for locked steps */}
      {isLocked && step.blockingReasons.length > 0 && (
        <div className="px-4 pb-3 -mt-1">
          <ul className="space-y-0.5">
            {step.blockingReasons.map((reason, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-gray-300 shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expanded content */}
      {expanded && children && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  data: CaseWorkspaceResponse;
  onRefresh: () => void;
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function WorkflowStepsCard({ data, onRefresh }: Props) {
  const steps = data.workflowSteps;

  // Auto-expand the first active step
  const firstActiveIdx = steps.findIndex((s) => s.status === "active");
  const [expandedKey, setExpandedKey] = useState<string | null>(
    firstActiveIdx >= 0 ? steps[firstActiveIdx].key : null,
  );

  function toggle(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  function renderStepContent(step: WorkflowStep): React.ReactNode {
    if (step.status !== "active" && step.status !== "complete") return null;

    // Only render forms for active steps
    if (step.status !== "active") return null;

    switch (step.key) {
      case "root_cause_assessment":
        return (
          <RootCauseStep
            caseId={data.case.id}
            existing={data.rootCauseAssessment}
            onSaved={onRefresh}
          />
        );
      case "sart_referral":
        return (
          <SartReferralStep
            caseId={data.case.id}
            existing={data.sartData}
            currentUserName={data.case.assignedTo?.name ?? ""}
            onSaved={onRefresh}
          />
        );
      case "sart_meeting":
        return (
          <SartMeetingStep
            caseId={data.case.id}
            studentId={data.case.studentId}
            schoolId={data.case.schoolId}
            districtToolkit={data.districtToolkit}
            onSaved={onRefresh}
          />
        );
      case "sart_action_plan":
        return (
          <SartActionPlanStep
            caseId={data.case.id}
            studentId={data.case.studentId}
            schoolId={data.case.schoolId}
            onSaved={onRefresh}
          />
        );
      case "sart_followup":
        return (
          <SartFollowupStep
            caseId={data.case.id}
            studentId={data.case.studentId}
            schoolId={data.case.schoolId}
            sartMeetingDate={data.sartMeeting?.meeting_date ?? ""}
            actionPlanItems={data.sartActionPlan}
            onSaved={onRefresh}
          />
        );
      default:
        // truancy_letter, parent_conference, sarb_packet — handled by other cards
        return (
          <p className="text-sm text-gray-500">
            Complete this step using the actions and documents panels below.
          </p>
        );
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Compliance Workflow
        </h3>

        <div className="space-y-2">
          {steps.map((step, idx) => (
            <StepRow
              key={step.key}
              step={step}
              stepNumber={idx + 1}
              expanded={expandedKey === step.key}
              onToggle={() => toggle(step.key)}
            >
              {renderStepContent(step)}
            </StepRow>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Shield className="h-3.5 w-3.5" />
          <span>
            All steps are timestamped and stored with audit trail integrity.
          </span>
        </div>
      </div>
    </div>
  );
}
