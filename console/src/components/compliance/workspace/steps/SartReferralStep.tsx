/**
 * SART Referral step — trigger, date, prior interventions, referred_by.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { saveSartReferral } from "@/services/compliance/saveSartReferral";
import type { SartReferralData } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TRIGGER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "absences_threshold", label: "Absences Threshold Crossed" },
  { value: "teacher_concern", label: "Teacher Concern" },
  { value: "parent_request", label: "Parent Request" },
  { value: "reentry", label: "Re-entry from Extended Absence" },
];

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  existing: SartReferralData | null;
  currentUserName: string;
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SartReferralStep({
  caseId,
  existing,
  currentUserName,
  onSaved,
}: Props) {
  const [trigger, setTrigger] = useState(
    existing?.referral_trigger ?? "",
  );
  const [referralDate, setReferralDate] = useState(
    existing?.referral_date ?? new Date().toISOString().slice(0, 10),
  );
  const [priorInterventions, setPriorInterventions] = useState(
    existing?.prior_informal_interventions ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !!trigger && !!referralDate && !saving;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveSartReferral(caseId, {
      referral_trigger: trigger as SartReferralData["referral_trigger"],
      referral_date: referralDate,
      prior_informal_interventions: priorInterventions,
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
      {/* Trigger */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Referral Trigger
        </label>
        <select
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="">Select trigger...</option>
          {TRIGGER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Referral Date
        </label>
        <input
          type="date"
          value={referralDate}
          onChange={(e) => setReferralDate(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Prior interventions */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Prior Informal Interventions
        </label>
        <textarea
          value={priorInterventions}
          onChange={(e) => setPriorInterventions(e.target.value)}
          placeholder="Describe any informal interventions attempted before this referral..."
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Referred by */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Referred By
        </label>
        <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700">
          {currentUserName}
        </div>
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
        Log SART Referral
      </button>
    </div>
  );
}
