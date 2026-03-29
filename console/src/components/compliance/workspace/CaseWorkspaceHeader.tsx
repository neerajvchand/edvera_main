import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowLeft, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { approveSarbPacket, requestSarbChanges } from "@/services/compliance/updateCase";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TIER_STYLES: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: "Tier 1", bg: "bg-amber-100", text: "text-amber-800" },
  2: { label: "Tier 2", bg: "bg-orange-500", text: "text-white" },
  3: { label: "Tier 3", bg: "bg-red-600", text: "text-white" },
};

const SIGNAL_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  stable: { label: "Stable", bg: "bg-gray-100", text: "text-gray-700" },
  softening: { label: "Softening", bg: "bg-yellow-100", text: "text-yellow-800" },
  elevated: { label: "Elevated", bg: "bg-red-100", text: "text-red-700" },
  pending: { label: "Pending", bg: "bg-gray-100", text: "text-gray-500" },
};

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Open", bg: "bg-blue-50", text: "text-blue-700" },
  in_progress: { label: "In Progress", bg: "bg-yellow-50", text: "text-yellow-700" },
  submitted: { label: "Submitted", bg: "bg-emerald-50", text: "text-emerald-700" },
  resolved: { label: "Resolved", bg: "bg-gray-100", text: "text-gray-600" },
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  data: CaseWorkspaceResponse;
  onRefresh: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CaseWorkspaceHeader({ data, onRefresh }: Props) {
  const c = data.case;
  const m = data.metrics;
  const tier = TIER_STYLES[c.tier] ?? TIER_STYLES[1];
  const signal = SIGNAL_STYLES[c.signalLevel] ?? SIGNAL_STYLES.stable;
  const status = STATUS_STYLES[c.status] ?? STATUS_STYLES.open;

  // Principal approval state
  const showApprovalBanner =
    c.sarbPacketStatus === "ready_for_approval" && data.permissions.canApproveEscalation;
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvalAction, setApprovalAction] = useState<"approve" | "changes" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    try {
      await approveSarbPacket(c.id, approvalNotes || undefined);
      setApprovalAction(null);
      setApprovalNotes("");
      onRefresh();
    } catch (err) {
      console.error("Approval failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestChanges() {
    setSubmitting(true);
    try {
      await requestSarbChanges(c.id, approvalNotes);
      setApprovalAction(null);
      setApprovalNotes("");
      onRefresh();
    } catch (err) {
      console.error("Request changes failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6">
      {/* Back link */}
      <Link
        to="/compliance"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-700 mb-3 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Compliance
      </Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Left side */}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            <Link
              to={`/student/${c.studentId}`}
              className="hover:text-emerald-700 transition-colors"
            >
              {c.studentName}
            </Link>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {c.schoolName}
            <span className="mx-1.5">&middot;</span>
            Grade {c.grade}
            <span className="mx-1.5">&middot;</span>
            Opened {formatDate(c.openedAt)}
          </p>

          {/* Pills row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full",
                tier.bg,
                tier.text
              )}
            >
              {tier.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full",
                signal.bg,
                signal.text
              )}
            >
              {signal.label}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          {/* Stat blocks */}
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unexcused
              </p>
              <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
                {m.unexcusedAbsences}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Truancy
              </p>
              <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
                {m.truancyCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </p>
              <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
                {m.totalAbsences}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full",
                status.bg,
                status.text
              )}
            >
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Escalation Blocked Warning */}
      {c.escalationBlockedReason && !c.isResolved && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Escalation Blocked</p>
              <p className="text-xs text-amber-700 mt-0.5">{c.escalationBlockedReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Principal Approval Banner */}
      {showApprovalBanner && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900">
                SARB Packet Awaiting Your Approval
              </h4>
              <p className="text-xs text-blue-700 mt-1">
                This SARB referral packet has been assembled and is ready for principal review
                before submission to the county SARB coordinator.
              </p>

              {approvalAction === null ? (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setApprovalAction("approve")}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Approve Packet
                  </button>
                  <button
                    onClick={() => setApprovalAction("changes")}
                    className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Request Changes
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder={
                      approvalAction === "approve"
                        ? "Optional approval notes..."
                        : "Describe what changes are needed..."
                    }
                    rows={2}
                    className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={
                        approvalAction === "approve"
                          ? handleApprove
                          : handleRequestChanges
                      }
                      disabled={
                        submitting ||
                        (approvalAction === "changes" && !approvalNotes.trim())
                      }
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2",
                        approvalAction === "approve"
                          ? "text-white bg-emerald-600 hover:bg-emerald-700"
                          : "text-amber-700 bg-amber-100 hover:bg-amber-200"
                      )}
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {approvalAction === "approve"
                        ? "Confirm Approval"
                        : "Send Back for Changes"}
                    </button>
                    <button
                      onClick={() => {
                        setApprovalAction(null);
                        setApprovalNotes("");
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval notification for non-approvers */}
      {c.sarbPacketStatus === "ready_for_approval" && !data.permissions.canApproveEscalation && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-xs text-yellow-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            SARB packet is awaiting principal approval before it can be submitted.
          </p>
        </div>
      )}
    </div>
  );
}
