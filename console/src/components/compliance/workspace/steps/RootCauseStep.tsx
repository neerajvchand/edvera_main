/**
 * Root Cause Assessment step — checkbox grid with notes and narrative.
 * Categories: transportation, housing_instability, health_medical,
 * family_circumstances, school_climate, academic_struggles,
 * work_obligations, unknown.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { saveRootCauseAssessment } from "@/services/compliance/saveRootCauseAssessment";
import type { RootCauseAssessment } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "transportation", label: "Transportation" },
  { key: "housing_instability", label: "Housing Instability" },
  { key: "health_medical", label: "Health / Medical" },
  { key: "family_circumstances", label: "Family Circumstances" },
  { key: "school_climate", label: "School Climate" },
  { key: "academic_struggles", label: "Academic Struggles" },
  { key: "work_obligations", label: "Work Obligations" },
  { key: "unknown", label: "Unknown / Other" },
];

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  existing: RootCauseAssessment | null;
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function RootCauseStep({ caseId, existing, onSaved }: Props) {
  const [categories, setCategories] = useState<
    Record<string, { checked: boolean; notes: string }>
  >(() => {
    const init: Record<string, { checked: boolean; notes: string }> = {};
    for (const cat of CATEGORIES) {
      init[cat.key] = existing?.categories?.[cat.key] ?? {
        checked: false,
        notes: "",
      };
    }
    return init;
  });

  const [narrative, setNarrative] = useState(existing?.narrative ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const narrativeLen = narrative.trim().length;
  const checkedCount = Object.values(categories).filter(
    (c: { checked: boolean; notes: string }) => c.checked,
  ).length;
  const canSave = checkedCount > 0 && narrativeLen >= 50 && !saving;

  function toggleCategory(key: string) {
    setCategories((prev) => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  }

  function setCategoryNotes(key: string, notes: string) {
    setCategories((prev) => ({
      ...prev,
      [key]: { ...prev[key], notes },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveRootCauseAssessment(caseId, {
      categories,
      narrative: narrative.trim(),
    });
    setSaving(false);
    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? "Failed to save.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Category checkboxes */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Root Cause Categories (select all that apply)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CATEGORIES.map((cat) => {
            const val = categories[cat.key];
            return (
              <div key={cat.key}>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={val.checked}
                    onChange={() => toggleCategory(cat.key)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">{cat.label}</span>
                </label>
                {val.checked && (
                  <textarea
                    value={val.notes}
                    onChange={(e) => setCategoryNotes(cat.key, e.target.value)}
                    placeholder={`Notes about ${cat.label.toLowerCase()}...`}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Narrative */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Narrative Summary (required, min 50 characters)
        </label>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="Describe the root causes identified and how they relate to the student's attendance pattern..."
          rows={4}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
        <p
          className={cn(
            "text-xs mt-1",
            narrativeLen >= 50 ? "text-emerald-600" : "text-gray-400",
          )}
        >
          {narrativeLen}/50 characters minimum
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!canSave}
        className={cn(
          "w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
          canSave
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed",
        )}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Root Cause Assessment
      </button>
    </div>
  );
}
