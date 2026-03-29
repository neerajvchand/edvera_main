import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, AlertCircle, Loader2 } from "lucide-react";
import type { ActionItem } from "@/types/caseWorkspace";
import type { ActionCompletionData } from "@/services/actions/completeAction";
import {
  todayISO,
  LetterForm,
  CallForm,
  ConferenceForm,
  GenericForm,
} from "./completionForms";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  action: ActionItem;
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (actionId: string, data: ActionCompletionData) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Type Helpers                                                        */
/* ------------------------------------------------------------------ */

function isLetterType(type: string): boolean {
  return [
    "send_truancy_letter",
    "truancy_notification",
    "send_notification_letter",
    "send_letter",
  ].includes(type);
}

function isCallType(type: string): boolean {
  return [
    "followup_call",
    "follow_up_call",
    "follow_up_contact",
    "phone_call",
  ].includes(type);
}

function isConferenceType(type: string): boolean {
  return [
    "schedule_conference",
    "parent_guardian_conference",
    "conference",
  ].includes(type);
}

function isSarbType(type: string): boolean {
  return [
    "prepare_sarb_packet",
    "sarb_referral",
    "sarb_packet",
  ].includes(type);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isValid(type: string, data: Record<string, unknown>): boolean {
  if (isLetterType(type)) return !!data.method;
  if (isCallType(type)) return !!data.outcome;
  if (isConferenceType(type)) return !!(data.conferenceStatus && data.ec48262Notified);
  return true;
}

function toCompletionData(
  type: string,
  data: Record<string, unknown>
): ActionCompletionData {
  if (isLetterType(type)) {
    return {
      completedAt: (data.dateSent as string) ?? todayISO(),
      notes: (data.notes as string) || undefined,
      method: data.method as string,
      trackingNumber: (data.trackingNumber as string) || undefined,
    };
  }
  if (isCallType(type)) {
    return {
      completedAt: (data.callDate as string) ?? todayISO(),
      outcome: data.outcome as string,
      notes: (data.notes as string) || undefined,
    };
  }
  if (isConferenceType(type)) {
    return {
      completedAt: (data.conferenceDate as string) ?? todayISO(),
      conferenceDate: data.conferenceDate as string,
      conferenceStatus: data.conferenceStatus as string,
      attendees: (data.attendees as string[]) ?? [],
      resourcesOffered:
        ((data.resources as string[]) ?? []).length > 0 || false,
      ec48262Notified: !!data.ec48262Notified,
      commitmentsMade: (data.commitments as string) || undefined,
      followUpDate: (data.followUpDate as string) || undefined,
      notes: (data.notes as string) || undefined,
    };
  }
  return {
    completedAt: (data.dateCompleted as string) ?? todayISO(),
    notes: (data.notes as string) || undefined,
  };
}

function buttonLabel(type: string): string {
  if (isLetterType(type)) return "Mark as Sent";
  return "Mark Complete";
}

/* ------------------------------------------------------------------ */
/* Modal Component                                                     */
/* ------------------------------------------------------------------ */

export function ActionCompletionModal({
  action,
  caseId: _caseId,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: Props) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const update = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  const canSubmit = isValid(action.type, formData) && !isSubmitting;

  const handleSubmit = () => {
    const completion = toCompletionData(action.type, formData);
    onSubmit(action.id, completion);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in"
        onClick={onClose}
      />
      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Complete: {action.title}
            </h2>
            {action.description && (
              <p className="text-sm text-gray-500 mt-0.5">
                {action.description}
              </p>
            )}
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
          {isLetterType(action.type) && (
            <LetterForm data={formData} onChange={update} />
          )}
          {isCallType(action.type) && (
            <CallForm data={formData} onChange={update} />
          )}
          {isConferenceType(action.type) && (
            <ConferenceForm data={formData} onChange={update} />
          )}
          {isSarbType(action.type) && (
            <GenericForm data={formData} onChange={update} />
          )}
          {!isLetterType(action.type) &&
            !isCallType(action.type) &&
            !isConferenceType(action.type) &&
            !isSarbType(action.type) && (
              <GenericForm data={formData} onChange={update} />
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
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {buttonLabel(action.type)}
          </button>
        </div>
      </div>
    </div>
  );
}
