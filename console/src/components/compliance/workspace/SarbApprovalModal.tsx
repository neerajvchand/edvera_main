/**
 * SarbApprovalModal — for principals to approve or request changes
 * on a SARB packet directly from the NextBestAction card.
 *
 * Uses existing approveSarbPacket / requestSarbChanges services.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Loader2, AlertCircle, Shield } from "lucide-react";
import {
  approveSarbPacket,
  requestSarbChanges,
} from "@/services/compliance/updateCase";

interface Props {
  isOpen: boolean;
  caseId: string;
  onClose: () => void;
  onCompleted: () => void;
}

type Mode = "approve" | "request_changes" | null;

export function SarbApprovalModal({
  isOpen,
  caseId,
  onClose,
  onCompleted,
}: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSubmit =
    mode === "approve"
      ? !submitting
      : mode === "request_changes"
        ? !!notes.trim() && !submitting
        : false;

  const handleSubmit = async () => {
    if (!mode) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "approve") {
        await approveSarbPacket(caseId, notes || undefined);
      } else {
        await requestSarbChanges(caseId, notes);
      }
      onCompleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process approval"
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
            <Shield className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Review SARB Packet
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
          <p className="text-sm text-gray-600">
            This packet is awaiting your review. You may approve it for
            submission to the SARB board or request changes from the case owner.
          </p>

          {/* Decision buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("approve")}
              className={cn(
                "px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors",
                mode === "approve"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              ✓ Approve Packet
            </button>
            <button
              onClick={() => setMode("request_changes")}
              className={cn(
                "px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors",
                mode === "request_changes"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              ✎ Request Changes
            </button>
          </div>

          {/* Notes */}
          {mode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === "approve" ? "Notes (optional)" : "Required feedback"}
                {mode === "request_changes" && (
                  <span className="text-red-500"> *</span>
                )}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={
                  mode === "approve"
                    ? "Optional approval notes…"
                    : "Describe what changes are needed…"
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
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
                ? mode === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
                : "bg-gray-300 cursor-not-allowed"
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "approve"
              ? "Approve Packet"
              : mode === "request_changes"
                ? "Request Changes"
                : "Select an option"}
          </button>
        </div>
      </div>
    </div>
  );
}
