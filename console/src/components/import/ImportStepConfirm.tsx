import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Action bar shown at the bottom of the validation step.
 * Contains the Back button and the Import confirmation button.
 */
export function ImportStepConfirm({
  importableCount,
  onImport,
  onBack,
}: {
  importableCount: number;
  onImport: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex justify-between">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <button
        disabled={importableCount === 0}
        onClick={onImport}
        className={cn(
          "inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors",
          importableCount > 0
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
        )}
      >
        Import {importableCount.toLocaleString()} valid rows
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
