/**
 * AssignOwnerModal — select a staff member to own this case.
 *
 * Fetches school staff via getSchoolStaff, lets user pick one,
 * then calls updateCaseFields to assign and advance stage.
 */
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Loader2, AlertCircle, UserPlus } from "lucide-react";
import {
  getSchoolStaff,
  type StaffMember,
} from "@/services/compliance/getSchoolStaff";
import { updateCaseFields } from "@/services/compliance/updateCase";
import { advanceCaseWorkflowStage } from "@/services/compliance/updateCase";

interface Props {
  isOpen: boolean;
  caseId: string;
  schoolId: string;
  onClose: () => void;
  onAssigned: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  attendance_clerk: "Attendance Clerk",
  counselor: "Counselor",
  principal: "Principal",
  district_admin: "District Admin",
};

export function AssignOwnerModal({
  isOpen,
  caseId,
  schoolId,
  onClose,
  onAssigned,
}: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    getSchoolStaff(schoolId)
      .then((result) => {
        setStaff(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load staff");
        setLoading(false);
      });
  }, [isOpen, schoolId]);

  if (!isOpen) return null;

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateCaseFields(caseId, { assigned_to: selectedUserId });
      await advanceCaseWorkflowStage(caseId, "outreach_in_progress");
      onAssigned();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to assign case owner"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in"
        onClick={onClose}
      />
      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Assign Case Owner
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
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">
                Loading staff…
              </span>
            </div>
          ) : staff.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No assignable staff found for this school.
            </p>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a staff member
              </label>
              {staff.map((s) => (
                <button
                  key={s.userId}
                  onClick={() => setSelectedUserId(s.userId)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors",
                    selectedUserId === s.userId
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {s.displayName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ROLE_LABELS[s.role] ?? s.role}
                    </p>
                  </div>
                  {selectedUserId === s.userId && (
                    <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
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
            onClick={handleAssign}
            disabled={!selectedUserId || submitting}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2",
              selectedUserId && !submitting
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-300 cursor-not-allowed"
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
