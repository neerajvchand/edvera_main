import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { STEPS, type WizardStep } from "@/hooks/useImportFlow";

export function ImportProgressBar({
  currentStep,
  completedSteps,
}: {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.has(step.key);
        const isCurrent = step.key === currentStep;
        const isFuture = i > currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "w-8 h-0.5 mx-1",
                  isCompleted || isCurrent ? "bg-emerald-300" : "bg-slate-200"
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                      ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500"
                      : "bg-slate-100 text-slate-400"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:inline",
                  isCurrent
                    ? "text-slate-900"
                    : isFuture
                      ? "text-slate-400"
                      : "text-slate-600"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
