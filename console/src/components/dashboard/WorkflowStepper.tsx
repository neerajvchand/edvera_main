import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { CARD } from "@/lib/designTokens";
import type { CaseRow } from "./NeedsAttentionQueue";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface WorkflowStep {
  label: string;
  status: "done" | "active" | "pending";
}

interface WorkflowStepperProps {
  selectedCase: CaseRow | null;
}

/* ------------------------------------------------------------------ */
/* Step labels (always the same, status varies)                        */
/* ------------------------------------------------------------------ */

const STEP_LABELS = [
  "Tier 1 letter sent & filed",
  "Parent notified",
  "SART conference logged",
  "SARB packet assembly",
  "Principal approval",
  "SARB hearing",
  "DA referral if needed",
];

/** Derive step statuses from a tier number. */
function buildSteps(tier: number | null): WorkflowStep[] {
  // Map tier to the index of the "active" step.
  // null or tier 1 with no progress → step 0 active, rest pending
  let activeIndex: number;
  if (tier === null || tier <= 0) activeIndex = 0;
  else if (tier === 1) activeIndex = 1;
  else if (tier === 2) activeIndex = 3;
  else activeIndex = 5; // tier 3+

  return STEP_LABELS.map((label, i) => ({
    label,
    status:
      i < activeIndex ? "done" : i === activeIndex ? "active" : "pending",
  }));
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function WorkflowStepper({ selectedCase }: WorkflowStepperProps) {
  if (!selectedCase) {
    return (
      <div className={`${CARD} mb-0`}>
        <p
          style={{
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "13px",
            padding: "16px 0",
            fontStyle: "italic",
          }}
        >
          Select a student above to view their compliance workflow
        </p>
      </div>
    );
  }

  const title = `${selectedCase.studentName} — compliance workflow · EC §48260–48264`;
  const steps = buildSteps(selectedCase.tier);

  return (
    <div className={`${CARD} p-3 mb-0`}>
      <p className="text-[11px] font-medium text-gray-900 mb-3">{title}</p>

      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              {/* Circle */}
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium mb-1",
                  step.status === "done" && "bg-emerald-50 text-emerald-600",
                  step.status === "active" && "bg-brand-500 text-white",
                  step.status === "pending" &&
                    "bg-gray-100 text-gray-400 border border-gray-200",
                )}
              >
                {step.status === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-[9px] text-center leading-tight px-0.5",
                  step.status === "active"
                    ? "text-gray-900 font-medium"
                    : "text-gray-400",
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-4 mt-3.5 shrink-0",
                  step.status === "done" ? "bg-emerald-400" : "bg-gray-200",
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
