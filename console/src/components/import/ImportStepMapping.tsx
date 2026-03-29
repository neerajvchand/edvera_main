import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Shield,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  detectColumnHints,
  areRequiredFieldsMapped,
  countMappedRequired,
  EDVERA_FIELDS,
  REQUIRED_FIELDS,
  type ColumnMapping,
  type ColumnHint,
} from "@/lib/engines/csv-processor";
import type { ParsedFile } from "@/hooks/useImportFlow";

export function ImportStepMapping({
  parsed,
  mapping,
  onMappingChange,
  onContinue,
  onBack,
}: {
  parsed: ParsedFile;
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const mappedRequiredCount = useMemo(
    () => countMappedRequired(mapping),
    [mapping]
  );

  const allRequiredMapped = useMemo(
    () => areRequiredFieldsMapped(mapping),
    [mapping]
  );

  // Which edvera fields are already taken
  const usedFields = useMemo(() => {
    const s = new Set<string>();
    for (const v of Object.values(mapping)) {
      if (v !== "skip") s.add(v);
    }
    return s;
  }, [mapping]);

  // Smart hints for unmapped columns with status-like values
  const hints = useMemo(
    () => detectColumnHints(parsed.headers, parsed.rows, mapping),
    [parsed.headers, parsed.rows, mapping]
  );
  const hintMap = useMemo(() => {
    const m = new Map<string, ColumnHint>();
    for (const h of hints) m.set(h.csvHeader, h);
    return m;
  }, [hints]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {parsed.name}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {parsed.rows.length.toLocaleString()} rows &middot;{" "}
            {parsed.headers.length} columns
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {mappedRequiredCount}/{REQUIRED_FIELDS.length} required fields
          mapped
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {parsed.headers.map((header) => {
          const currentValue = mapping[header] ?? "skip";
          const fieldDef = EDVERA_FIELDS.find((f) => f.key === currentValue);
          const isRequired = fieldDef?.required ?? false;
          const isMapped = currentValue !== "skip";
          const hint = !isMapped ? hintMap.get(header) : undefined;

          return (
            <div key={header} className="px-4 py-3">
              <div className="flex items-center gap-4">
                {/* Status icon */}
                <div className="w-5 shrink-0">
                  {isMapped && isRequired ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : isMapped ? (
                    <CheckCircle2 className="h-4 w-4 text-slate-300" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-slate-200" />
                  )}
                </div>

                {/* CSV column name */}
                <div className="flex-1 min-w-0">
                  <code className="text-sm text-slate-700 bg-slate-50 px-2 py-0.5 rounded font-mono">
                    {header}
                  </code>
                  {parsed.rows[0]?.[header] && (
                    <span className="ml-2 text-xs text-slate-400">
                      e.g. &ldquo;{parsed.rows[0][header]}&rdquo;
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />

                {/* Mapping dropdown */}
                <div className="relative w-48 shrink-0">
                  <select
                    value={currentValue}
                    onChange={(e) => {
                      onMappingChange({
                        ...mapping,
                        [header]: e.target.value,
                      });
                    }}
                    className={cn(
                      "w-full appearance-none rounded-lg border pl-3 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500",
                      isMapped
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-white text-slate-500"
                    )}
                  >
                    <option value="skip">Skip this column</option>
                    {EDVERA_FIELDS.map((f) => {
                      // full_name_last_first is disabled if first_name or last_name are individually mapped
                      // first_name / last_name are disabled if full_name_last_first is already mapped
                      let isDisabled = usedFields.has(f.key) && currentValue !== f.key;
                      if (f.key === "full_name_last_first" && currentValue !== f.key) {
                        if (usedFields.has("first_name") || usedFields.has("last_name")) isDisabled = true;
                      }
                      if ((f.key === "first_name" || f.key === "last_name") && currentValue !== f.key) {
                        if (usedFields.has("full_name_last_first")) isDisabled = true;
                      }
                      const isReq = f.required ||
                        (f.key === "full_name_last_first" && !usedFields.has("first_name") && !usedFields.has("last_name"));
                      return (
                        <option
                          key={f.key}
                          value={f.key}
                          disabled={isDisabled}
                        >
                          {f.label}
                          {isReq ? " *" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Amber hint for unmapped columns with detected values */}
              {hint && (
                <button
                  onClick={() => {
                    onMappingChange({ ...mapping, [header]: hint.suggestedField });
                  }}
                  className="ml-9 mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  {hint.reason}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2 mt-4">
        <Shield className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="text-xs text-slate-500">
          Unmapped columns are never stored, transmitted, or logged.
        </span>
      </div>

      {!allRequiredMapped && (
        <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Map all required fields (marked with *) to continue
        </p>
      )}

      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          disabled={!allRequiredMapped}
          onClick={onContinue}
          className={cn(
            "inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-lg transition-colors",
            allRequiredMapped
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
