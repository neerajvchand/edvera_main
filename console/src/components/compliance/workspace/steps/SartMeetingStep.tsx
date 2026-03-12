/**
 * SART Meeting step — date, attendees, agenda, outcome, notes.
 * Includes county toolkit link and outcome branching info.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ExternalLink } from "lucide-react";
import { saveSartMeeting } from "@/services/compliance/saveSartMeeting";
import type { SartMeetingOutcome } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const ATTENDEE_OPTIONS = [
  "Attendance Clerk",
  "Counselor",
  "Principal",
  "Parent",
  "Student",
  "Other",
];

const AGENDA_ITEMS: Array<{ key: string; label: string }> = [
  { key: "review_attendance", label: "Review attendance record" },
  { key: "review_prior_interventions", label: "Review prior interventions" },
  { key: "family_perspective", label: "Hear family perspective" },
  { key: "identify_barriers", label: "Identify barriers to attendance" },
  { key: "agree_action_plan", label: "Agree on action plan" },
];

const OUTCOME_OPTIONS: Array<{ value: SartMeetingOutcome; label: string; description: string }> = [
  { value: "action_plan_agreed", label: "Action Plan Agreed", description: "Proceed to create SART action plan and 30-day follow-up." },
  { value: "escalate_sarb", label: "Escalate to SARB", description: "Action plan and follow-up still required before SARB packet." },
  { value: "close_case", label: "Close Case", description: "Issue resolved at SART level. Skips action plan and follow-up." },
];

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  studentId: string;
  schoolId: string;
  districtToolkit: { url: string; name: string } | null;
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SartMeetingStep({
  caseId,
  studentId,
  schoolId,
  districtToolkit,
  onSaved,
}: Props) {
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [attendees, setAttendees] = useState<string[]>([]);
  const [familyPresent, setFamilyPresent] = useState(false);
  const [agenda, setAgenda] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<SartMeetingOutcome | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !!meetingDate && attendees.length > 0 && !!outcome && !saving;

  function toggleAttendee(name: string) {
    setAttendees((prev) =>
      prev.includes(name)
        ? prev.filter((a) => a !== name)
        : [...prev, name],
    );
  }

  function toggleAgenda(key: string) {
    setAgenda((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!outcome) return;
    setSaving(true);
    setError(null);
    const result = await saveSartMeeting(caseId, studentId, schoolId, {
      meeting_date: meetingDate,
      attendees,
      family_present: familyPresent,
      agenda_checklist: agenda,
      outcome,
      notes,
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
      {/* County toolkit link */}
      <div className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
        {districtToolkit ? (
          <a
            href={districtToolkit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-700 font-medium flex items-center gap-1.5 hover:text-blue-800"
          >
            Reference toolkit: {districtToolkit.name}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-sm text-blue-600">
            Consult your county SART resources
          </p>
        )}
      </div>

      {/* Meeting date */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Meeting Date
        </label>
        <input
          type="date"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Attendees */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Attendees
        </label>
        <div className="flex flex-wrap gap-2">
          {ATTENDEE_OPTIONS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleAttendee(name)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                attendees.includes(name)
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Family present */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Family Present
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFamilyPresent(true)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors",
              familyPresent
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-gray-200 text-gray-500",
            )}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setFamilyPresent(false)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors",
              !familyPresent
                ? "bg-red-50 border-red-300 text-red-700"
                : "bg-white border-gray-200 text-gray-500",
            )}
          >
            No
          </button>
        </div>
      </div>

      {/* Agenda checklist */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Agenda Items
        </label>
        <div className="space-y-1.5">
          {AGENDA_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!agenda[item.key]}
                onChange={() => toggleAgenda(item.key)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Outcome */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Meeting Outcome
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
                name="sart_outcome"
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
          placeholder="Meeting notes..."
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
        Save SART Meeting
      </button>
    </div>
  );
}
