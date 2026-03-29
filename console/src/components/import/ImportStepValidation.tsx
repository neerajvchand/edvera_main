import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import type { NormalizationEntry } from "@/lib/engines/csv-processor";
import type { ValidatedRow } from "@/hooks/useImportFlow";
import { ImportErrorList } from "./ImportErrorList";
import { ImportStepConfirm } from "./ImportStepConfirm";

export function ImportStepValidation({
  validatedRows,
  isAbsenceOnly,
  normSummary,
  onImport,
  onBack,
}: {
  validatedRows: ValidatedRow[];
  isAbsenceOnly: boolean;
  normSummary: NormalizationEntry[];
  onImport: () => void;
  onBack: () => void;
}) {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const validCount = validatedRows.filter((v) => v.result.valid && v.result.warnings.length === 0).length;
  const warnCount = validatedRows.filter((v) => v.result.valid && v.result.warnings.length > 0).length;
  const errorCount = validatedRows.filter((v) => !v.result.valid).length;
  const importableCount = validatedRows.filter((v) => v.result.valid).length;

  const displayRows = useMemo(() => {
    const rows = showErrorsOnly
      ? validatedRows.filter((v) => !v.result.valid || v.result.warnings.length > 0)
      : validatedRows;
    return rows.slice(0, 50);
  }, [validatedRows, showErrorsOnly]);

  return (
    <div>
      {/* Absence-only export notice */}
      {isAbsenceOnly && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2 mb-4">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            This file appears to contain absence records only. Students will be marked present for school days not included in this file.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">
              {validCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">rows valid</p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">
              {warnCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">with warnings</p>
          </div>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">
              {errorCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">will be skipped</p>
          </div>
        </div>
      </div>

      {/* Normalization summary */}
      {normSummary.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-xs font-semibold text-slate-700 mb-2">Status values normalized:</p>
          <div className="space-y-1">
            {normSummary.map((entry) => (
              <div key={entry.normalizedTo} className="flex items-baseline gap-2 text-xs">
                <span className="text-slate-400 font-mono truncate max-w-[280px]">
                  {entry.rawValues.map((v) => `"${v}"`).join(", ")}
                </span>
                <span className="text-slate-300 shrink-0">&rarr;</span>
                <span className="font-medium text-slate-700 shrink-0">{entry.normalizedTo}</span>
                <span className="text-slate-400 shrink-0">({entry.count} rows)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          Showing {displayRows.length} of {validatedRows.length} rows
        </p>
        <button
          onClick={() => setShowErrorsOnly(!showErrorsOnly)}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          {showErrorsOnly ? "Show all rows" : "Show issues only"}
        </button>
      </div>

      {/* Preview table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto mb-6 max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 text-left">
              <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                #
              </th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                &nbsp;
              </th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student ID
              </th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Issues
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayRows.map((v) => {
              const hasErrors = !v.result.valid;
              const hasWarnings =
                v.result.valid && v.result.warnings.length > 0;
              return (
                <tr
                  key={v.row._raw_row_index}
                  className={cn(
                    hasErrors
                      ? "bg-red-50/30"
                      : hasWarnings
                        ? "bg-amber-50/30"
                        : ""
                  )}
                >
                  <td className="py-2 px-3 text-xs text-slate-400 tabular-nums">
                    {v.row._raw_row_index + 1}
                  </td>
                  <td className="py-2 px-3">
                    {hasErrors ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : hasWarnings ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">
                    {v.row.student_sis_id || (
                      <span className="text-red-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {v.row.last_name && v.row.first_name
                      ? `${v.row.last_name}, ${v.row.first_name}`
                      : <span className="text-red-400">—</span>}
                  </td>
                  <td className="py-2 px-3 tabular-nums">
                    {v.row.attendance_date || (
                      <span className="text-red-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {v.row.status ? (
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          v.row.status === "present"
                            ? "bg-emerald-50 text-emerald-700"
                            : v.row.status === "absent"
                              ? "bg-red-50 text-red-700"
                              : v.row.status === "tardy"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-50 text-slate-700"
                        )}
                      >
                        {v.row.status}
                      </span>
                    ) : (
                      <span className="text-red-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-xs">
                    <ImportErrorList
                      errors={v.result.errors}
                      warnings={v.result.warnings}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <ImportStepConfirm
        importableCount={importableCount}
        onImport={onImport}
        onBack={onBack}
      />
    </div>
  );
}
