import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ImportSummary } from "@/hooks/useImportFlow";

function SummaryRow({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          warn
            ? "text-amber-600"
            : highlight
              ? "text-emerald-600"
              : "text-slate-900"
        )}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export function ImportStepComplete({
  summary,
  importPhase,
  importProgress,
  engineProgress,
}: {
  summary: ImportSummary | null;
  importPhase: string;
  importProgress: number;
  engineProgress: string;
}) {
  const navigate = useNavigate();
  const isComplete = summary !== null;

  return (
    <div className="max-w-lg mx-auto">
      {!isComplete ? (
        <div className="text-center space-y-6">
          <Loader2 className="h-10 w-10 text-emerald-500 mx-auto animate-spin" />
          <div>
            <p className="text-sm font-medium text-slate-700">{importPhase}</p>
            {importProgress > 0 && importProgress < 100 && (
              <div className="mt-3 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            )}
            {engineProgress && (
              <p className="text-xs text-slate-400 mt-2">{engineProgress}</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="text-center mb-6">
            <div className="rounded-full bg-emerald-50 p-3 inline-flex mb-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Import Complete!
            </h3>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {summary.schoolsCreated > 0 && (
              <SummaryRow label="Schools created" value={summary.schoolsCreated} />
            )}
            <SummaryRow label="Students created" value={summary.studentsCreated} />
            <SummaryRow label="Students updated" value={summary.studentsUpdated} />
            <SummaryRow
              label="Attendance records imported"
              value={summary.recordsImported}
              highlight
            />
            <SummaryRow
              label="Duplicates skipped"
              value={summary.duplicatesSkipped}
            />
            <SummaryRow label="Errors skipped" value={summary.errorsSkipped} />
            <SummaryRow
              label="New chronic absent detected"
              value={summary.newChronicDetected}
              warn={summary.newChronicDetected > 0}
            />
            <SummaryRow
              label="New compliance cases"
              value={summary.newComplianceCases}
            />
            <SummaryRow
              label="New actions generated"
              value={summary.newActionsGenerated}
            />
          </div>

          <div className="flex flex-col items-center gap-3 mt-6">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
