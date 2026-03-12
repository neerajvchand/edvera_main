import { XCircle, AlertTriangle } from "lucide-react";

/**
 * Inline error/warning display for a single validated row.
 * Used inside the validation preview table.
 */
export function ImportErrorList({
  errors,
  warnings,
}: {
  errors: string[];
  warnings: string[];
}) {
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <>
      {errors.length > 0 && (
        <span className="text-red-600 flex items-center gap-1">
          <XCircle className="h-3 w-3 shrink-0" />
          {errors.join("; ")}
        </span>
      )}
      {warnings.length > 0 && (
        <span className="text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {warnings.join("; ")}
        </span>
      )}
    </>
  );
}
