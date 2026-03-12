/**
 * Case Resolution Card — Chunk 3
 *
 * Allows authorized staff (canResolveCase) to resolve a case.
 * Uses the existing resolution_type column with its CHECK constraint.
 * Updates case status and records who resolved it.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Scale, CheckCircle2, Loader2 } from "lucide-react";
import { resolveCase } from "@/services/compliance/updateCase";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  workspaceData: CaseWorkspaceResponse;
  permissions: CaseWorkspaceResponse["permissions"];
  onResolved: () => void;
}

const RESOLUTION_OPTIONS: { value: string; label: string }[] = [
  { value: "attendance_improved", label: "Attendance Improved" },
  { value: "sarb_completed", label: "SARB Process Completed" },
  { value: "transferred", label: "Student Transferred" },
  { value: "withdrawn", label: "Student Withdrawn" },
  { value: "da_referral", label: "District Attorney Referral" },
  { value: "other", label: "Other" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CaseResolutionCard({
  caseId,
  workspaceData,
  permissions,
  onResolved,
}: Props) {
  const c = workspaceData.case;
  const [showForm, setShowForm] = useState(false);
  const [resolutionType, setResolutionType] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isResolved = c.isResolved;
  const canResolve = permissions.canResolveCase;

  async function handleResolve() {
    if (!resolutionType) return;
    setSubmitting(true);
    setError(null);

    try {
      await resolveCase(caseId, {
        resolutionType,
        notes: notes || null,
      });
      setShowForm(false);
      onResolved();
    } catch (err) {
      setError("Unexpected error");
      console.error("CaseResolutionCard: unexpected error", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("rounded-lg p-2", isResolved ? "bg-emerald-50" : "bg-gray-50")}>
          <Scale className={cn("h-4 w-4", isResolved ? "text-emerald-600" : "text-gray-500")} />
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          Case Resolution
        </h3>
      </div>

      {isResolved ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">Case Resolved</p>
          </div>
          {c.resolutionType && (
            <p className="text-xs text-gray-600 mb-1">
              <span className="font-medium">Resolution:</span>{" "}
              {RESOLUTION_OPTIONS.find((o) => o.value === c.resolutionType)?.label ?? c.resolutionType}
            </p>
          )}
          {c.resolvedAt && (
            <p className="text-xs text-gray-400">
              Resolved{" "}
              {new Date(c.resolvedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
          {c.resolutionNotes && (
            <p className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded-lg">
              {c.resolutionNotes}
            </p>
          )}
        </div>
      ) : showForm ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Resolution Type <span className="text-red-500">*</span>
            </label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Select resolution...</option>
              {RESOLUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Resolution notes..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleResolve}
              disabled={!resolutionType || submitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Resolve Case
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setResolutionType("");
                setNotes("");
                setError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {canResolve
              ? "Resolve this case when compliance requirements are met."
              : "Only authorized staff can resolve cases."}
          </p>
          {canResolve && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Resolve Case
            </button>
          )}
        </div>
      )}
    </div>
  );
}
