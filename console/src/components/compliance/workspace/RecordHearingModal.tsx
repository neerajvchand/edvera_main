/**
 * RecordHearingModal — enter the SARB hearing date and outcome.
 *
 * Updates the case's outcome_stage and records hearing details.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Loader2, AlertCircle, Gavel } from "lucide-react";
import {
  updateCaseFields,
  updateOutcomeStage,
  advanceCaseWorkflowStage,
} from "@/services/compliance/updateCase";
import type { OutcomeStage } from "@/lib/caseStages";

interface Props {
  isOpen: boolean;
  caseId: string;
  onClose: () => void;
  onRecorded: () => void;
}

const OUTCOME_OPTIONS: { value: OutcomeStage; label: string }[] = [
  { value: "hearing_scheduled", label: "Hearing scheduled (date set)" },
  { value: "agreement_reached", label: "Agreement reached at hearing" },
  { value: "returned_to_tier_2", label: "Returned to Tier 2 supports" },
  { value: "resolved", label: "Case resolved" },
  { value: "referred_out", label: "Referred to external agency" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";

export function RecordHearingModal({
  isOpen,
  caseId,
  onClose,
  onRecorded,
}: Props) {
  const [hearingDate, setHearingDate] = useState(todayISO());
  const [outcome, setOutcome] = useState<OutcomeStage | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSubmit = !!outcome && !!hearingDate && !submitting;

  const handleSubmit = async () => {
    if (!outcome) return;
    setSubmitting(true);
    setError(null);
    try {
      // Update hearing details
      await updateCaseFields(caseId, {
        hearing_date: hearingDate,
        hearing_notes: notes || null,
      });

      // Update outcome stage
      await updateOutcomeStage(caseId, outcome);

      // Handle workflow transitions based on outcome
      switch (outcome) {
        case "resolved":
        case "referred_out":
          // Terminal outcomes — close the case
          await advanceCaseWorkflowStage(caseId, "closed");
          break;

        case "agreement_reached":
          // Agreement reached — enter monitoring period to verify compliance
          await advanceCaseWorkflowStage(caseId, "monitoring_period");
          await updateCaseFields(caseId, {
            monitoring_started_at: new Date().toISOString(),
          });
          break;

        case "returned_to_tier_2":
          // Board returned case — reset workflow to outreach stage
          // so staff can re-engage with the family
          await advanceCaseWorkflowStage(caseId, "outreach_in_progress");
          break;

        // "hearing_scheduled" — no workflow change, just date recorded
      }

      onRecorded();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record hearing"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Record Hearing Result
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Hearing date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hearing date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={hearingDate}
              onChange={(e) => setHearingDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outcome <span className="text-red-500">*</span>
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as OutcomeStage)}
              className={INPUT_CLS}
            >
              <option value="">Select outcome…</option>
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Hearing details, agreements, follow-up actions…"
              className={INPUT_CLS}
            />
          </div>

          {/* Info callouts for each outcome */}
          {(outcome === "resolved" || outcome === "referred_out") && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">
                This outcome will close the case. The case can be reopened if needed.
              </p>
            </div>
          )}
          {outcome === "agreement_reached" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <p className="text-xs text-emerald-700">
                The case will enter a 30-60 day monitoring period to verify the family
                follows through on the agreement before closing.
              </p>
            </div>
          )}
          {outcome === "returned_to_tier_2" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-700">
                The case will return to outreach stage so staff can re-engage with the
                family with additional supports.
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2",
              canSubmit
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-300 cursor-not-allowed"
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Hearing Result
          </button>
        </div>
      </div>
    </div>
  );
}
