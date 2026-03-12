/**
 * SART 30-Day Follow-up step — attendance check, action item review,
 * outcome determination, and notes.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { saveSartFollowup } from "@/services/compliance/saveSartFollowup";
import type { SartActionItem } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const ATTENDANCE_OPTIONS: Array<{
  value: "yes" | "partial" | "no";
  label: string;
  color: string;
  activeColor: string;
}> = [
  { value: "yes", label: "Yes", color: "border-gray-200 text-gray-500", activeColor: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { value: "partial", label: "Partial", color: "border-gray-200 text-gray-500", activeColor: "bg-yellow-50 border-yellow-300 text-yellow-700" },
  { value: "no", label: "No", color: "border-gray-200 text-gray-500", activeColor: "bg-red-50 border-red-300 text-red-700" },
];

const OUTCOME_OPTIONS: Array<{
  value: "closed" | "continue_monitoring" | "escalate_sarb";
  label: string;
  description: string;
}> = [
  { value: "closed", label: "Close Case", description: "Attendance has improved sufficiently." },
  { value: "continue_monitoring", label: "Continue Monitoring", description: "Some improvement; schedule another follow-up." },
  { value: "escalate_sarb", label: "Escalate to SARB", description: "Insufficient progress; prepare SARB referral packet." },
];

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  studentId: string;
  schoolId: string;
  sartMeetingDate: string;
  actionPlanItems: SartActionItem[];
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SartFollowupStep({
  caseId,
  studentId,
  schoolId,
  sartMeetingDate,
  actionPlanItems,
  onSaved,
}: Props) {
  const [followupDate, setFollowupDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [attendanceImproved, setAttendanceImproved] = useState<
    "yes" | "partial" | "no" | ""
  >("");
  const [itemsCompleted, setItemsCompleted] = useState<
    Record<string, boolean>
  >({});
  const [outcome, setOutcome] = useState<
    "closed" | "continue_monitoring" | "escalate_sarb" | ""
  >("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    !saving && !!followupDate && !!attendanceImproved && !!outcome;

  function toggleItem(id: string) {
    setItemsCompleted((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSave() {
    if (!attendanceImproved || !outcome) return;
    setSaving(true);
    setError(null);
    const result = await saveSartFollowup(
      caseId,
      studentId,
      schoolId,
      sartMeetingDate,
      {
        followup_date: followupDate,
        attendance_improved: attendanceImproved,
        action_items_completed: itemsCompleted,
        outcome,
        notes,
      },
    );
    setSaving(false);
    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? "Failed to save.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Timing hint */}
      <div className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-sm text-blue-600">
          Follow-up should be 25–35 days after the SART meeting (
          {sartMeetingDate}).
        </p>
      </div>

      {/* Follow-up date */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Follow-up Date
        </label>
        <input
          type="date"
          value={followupDate}
          onChange={(e) => setFollowupDate(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Attendance improved */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Has Attendance Improved?
        </label>
        <div className="flex gap-2">
          {ATTENDANCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAttendanceImproved(opt.value)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                attendanceImproved === opt.value
                  ? opt.activeColor
                  : opt.color,
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action items checklist */}
      {actionPlanItems.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Action Items Completed
          </label>
          <div className="space-y-1.5">
            {actionPlanItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!itemsCompleted[item.id]}
                  onChange={() => toggleItem(item.id)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">
                  {item.description}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {item.assigned_role}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Outcome */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Follow-up Outcome
        </label>
        <div className="space-y-2">
          {OUTCOME_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors",
                outcome === opt.value
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300",
              )}
            >
              <input
                type="radio"
                name="followup_outcome"
                checked={outcome === opt.value}
                onChange={() => setOutcome(opt.value)}
                className="mt-0.5 h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Follow-up observations..."
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
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
        Save Follow-up
      </button>
    </div>
  );
}
