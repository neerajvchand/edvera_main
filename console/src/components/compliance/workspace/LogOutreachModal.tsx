/**
 * LogOutreachModal — record a family contact attempt.
 *
 * Creates a completed action row via logOutreach service,
 * then optionally advances the case stage.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Loader2, AlertCircle, PhoneCall } from "lucide-react";
import { logOutreach, type OutreachInput } from "@/services/actions/logOutreach";
import { advanceCaseWorkflowStage } from "@/services/compliance/updateCase";

interface Props {
  isOpen: boolean;
  caseId: string;
  studentId: string;
  schoolId: string;
  onClose: () => void;
  onLogged: () => void;
}

const CONTACT_TYPES = [
  { value: "phone", label: "Phone Call" },
  { value: "email", label: "Email" },
  { value: "home_visit", label: "Home Visit" },
  { value: "in_person", label: "In-Person Meeting" },
  { value: "letter", label: "Letter / Mail" },
] as const;

const OUTCOMES = [
  { value: "reached_positive", label: "Reached — positive response" },
  { value: "reached_no_resolution", label: "Reached — no resolution" },
  { value: "left_voicemail", label: "Left voicemail" },
  { value: "no_answer", label: "No answer" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "email_sent", label: "Email sent" },
  { value: "visit_completed", label: "Visit completed" },
  { value: "visit_no_answer", label: "Visit — no one home" },
] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";

export function LogOutreachModal({
  isOpen,
  caseId,
  studentId,
  schoolId,
  onClose,
  onLogged,
}: Props) {
  const [contactType, setContactType] = useState<OutreachInput["contactType"]>("phone");
  const [outcome, setOutcome] = useState<OutreachInput["outcome"] | "">("");
  const [contactDate, setContactDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [advanceStage, setAdvanceStage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSubmit = !!outcome && !!contactDate && !submitting;

  const handleSubmit = async () => {
    if (!outcome) return;
    setSubmitting(true);
    setError(null);
    try {
      await logOutreach(caseId, studentId, schoolId, {
        contactType,
        outcome: outcome as OutreachInput["outcome"],
        notes: notes || undefined,
        contactDate,
      });
      if (advanceStage) {
        await advanceCaseWorkflowStage(caseId, "barrier_assessment");
      }
      onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log outreach");
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
            <PhoneCall className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Log Family Contact
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
          {/* Contact date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact date
            </label>
            <input
              type="date"
              value={contactDate}
              onChange={(e) => setContactDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          {/* Contact type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact method
            </label>
            <select
              value={contactType}
              onChange={(e) =>
                setContactType(e.target.value as OutreachInput["contactType"])
              }
              className={INPUT_CLS}
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outcome <span className="text-red-500">*</span>
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as OutreachInput["outcome"])}
              className={INPUT_CLS}
            >
              <option value="">Select outcome…</option>
              {OUTCOMES.map((o) => (
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
              placeholder="Summarize the contact attempt…"
              className={INPUT_CLS}
            />
          </div>

          {/* Advance stage checkbox */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={advanceStage}
              onChange={(e) => setAdvanceStage(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-600">
              Advance case to Barrier Assessment stage
            </span>
          </label>
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
            Log Contact
          </button>
        </div>
      </div>
    </div>
  );
}
