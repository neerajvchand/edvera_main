/**
 * Conference Summary Modal — Chunk 3
 *
 * Pre-populates from the completed conference action's completion_data.
 * Uses existing generateConferenceSummary() from conference-summary.ts.
 * Follows the same upsert document pattern as TierLetterGenerationModal.
 */
import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import {
  generateConferenceSummary,
  type ConferenceSummaryInput,
} from "@/lib/documents/conference-summary";
import { saveDocument } from "@/services/documents/saveDocument";
import { getConferenceAction } from "@/services/actions/getConferenceAction";
import { getCurrentUserDisplayName } from "@/services/profiles/getCurrentUserDisplayName";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  workspaceData: CaseWorkspaceResponse;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STATUS_OPTIONS = [
  { value: "held_parent_attended", label: "Held — Parent Attended" },
  { value: "held_parent_absent", label: "Held — Parent Absent" },
  { value: "attempted", label: "Attempted — Unable to Reach" },
  { value: "rescheduled", label: "Rescheduled" },
];

const ALL_ATTENDEE_OPTIONS = [
  "Parent/Guardian",
  "School Counselor",
  "Principal",
  "Teacher",
  "Student",
  "Other",
];

const ALL_RESOURCE_OPTIONS = [
  "Transportation assistance",
  "Counseling referral",
  "Tutoring",
  "Community resources",
  "Mentoring program",
  "After-school program",
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ConferenceSummaryModal({
  caseId,
  workspaceData,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [conferenceDate, setConferenceDate] = useState("");
  const [status, setStatus] = useState("held_parent_attended");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [consequencesExplained, setConsequencesExplained] = useState(false);
  const [commitments, setCommitments] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate from completed conference action data
  useEffect(() => {
    async function loadConferenceData() {
      const action = await getConferenceAction(caseId).catch(() => null);

      if (action) {
        const cd = action.completionData;
        setConferenceDate(
          (cd.conference_date as string) ??
            action.completedAt?.slice(0, 10) ??
            ""
        );
        if (cd.status) setStatus(cd.status as string);
        if (cd.attendees && Array.isArray(cd.attendees)) {
          setAttendees(cd.attendees as string[]);
        }
        if (cd.resources_offered) setConsequencesExplained(true);
        if (cd.consequences_explained) setConsequencesExplained(true);
        if (cd.commitments) setCommitments(cd.commitments as string);
        if (cd.follow_up_date) setFollowUpDate(cd.follow_up_date as string);
        if (cd.notes) setNotes(cd.notes as string);
      }

      // Get current user name for preparedBy
      const displayName = await getCurrentUserDisplayName().catch(() => null);
      if (displayName) setPreparedBy(displayName);
    }
    loadConferenceData();
  }, [caseId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const c = workspaceData.case;
      const m = workspaceData.metrics;
      const today = new Date().toISOString().slice(0, 10);
      const nameParts = c.studentName.split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const input: ConferenceSummaryInput = {
        student: { firstName, lastName, grade: c.grade },
        school: { name: c.schoolName },
        district: { name: c.districtName },
        currentTier:
          c.tier === 3
            ? "tier_3_sarb_referral"
            : c.tier === 2
              ? "tier_2_conference"
              : "tier_1_letter",
        conferenceDate: conferenceDate || today,
        status,
        attendees,
        resources,
        consequencesExplained,
        commitments,
        followUpDate,
        notes,
        attendanceSummary: {
          daysEnrolled: m.daysEnrolled,
          daysAbsent: m.totalAbsences,
          attendanceRate: m.attendanceRate,
          unexcusedAbsences: m.unexcusedAbsences,
          truancyNoticesSent: workspaceData.documents.filter(
            (d) => d.docType === "tier1_notification"
          ).length,
        },
        preparedBy: preparedBy || "Staff",
        date: today,
      };

      // Generate PDF
      const blob = generateConferenceSummary(input);
      downloadBlob(
        blob,
        `Conference-Summary-${lastName}-${firstName}-${today}.pdf`
      );

      // Persist document record via saveDocument service
      const now = new Date().toISOString();
      await saveDocument({
        caseId,
        studentId: c.studentId,
        schoolId: c.schoolId,
        docType: "tier2_conference_summary",
        title: `Conference Summary — ${c.studentName}`,
        contentJson: { ...input, generatedAt: now },
      });

      onSuccess();
    } catch (err) {
      console.error("Conference summary generation failed:", err);
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (!isOpen) return null;

  function toggleAttendee(a: string) {
    setAttendees((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function toggleResource(r: string) {
    setResources((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Conference Summary
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Generate a Tier 2 conference summary per EC §48262.
        </p>

        <div className="space-y-4">
          {/* Conference Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Conference Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={conferenceDate}
              onChange={(e) => setConferenceDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Attendees
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ATTENDEE_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAttendee(a)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    attendees.includes(a)
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Resources Offered
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_RESOURCE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleResource(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    resources.includes(r)
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Consequences */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={consequencesExplained}
              onChange={(e) => setConsequencesExplained(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">
              Consequences of continued truancy explained per EC §48262
            </span>
          </label>

          {/* Commitments */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Commitments Made
            </label>
            <textarea
              value={commitments}
              onChange={(e) => setCommitments(e.target.value)}
              placeholder="Commitments agreed upon during conference..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Follow-up Date
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Discussion Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summary of conference discussion..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Prepared By */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Prepared By
            </label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Staff name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-500">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || !conferenceDate}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate & Download PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
