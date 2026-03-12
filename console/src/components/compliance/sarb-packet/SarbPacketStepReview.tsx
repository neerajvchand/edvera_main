import { Check, Circle, AlertTriangle } from "lucide-react";
import type {
  CaseDetailForModal,
  PacketComponent,
  Attendee,
} from "@/hooks/useSarbPacket";

export function SarbPacketStepReview({
  caseDetail,
  ssid,
  referralType,
  narrative,
  components,
  attendees,
  specialEdNotes,
}: {
  caseDetail: CaseDetailForModal;
  ssid: string;
  referralType: string;
  narrative: string;
  components: PacketComponent[];
  attendees: Attendee[];
  specialEdNotes: string;
}) {
  const requiredComplete = components.filter((c) => c.required).every((c) => c.status !== "not_started");
  const hasNarrative = narrative.trim().length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Review the packet summary before finalizing.</p>

      {/* Student info summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Student</h4>
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <div>
            <span className="text-gray-500">Name: </span>
            <span className="text-gray-900 font-medium">
              {caseDetail.student_first_name} {caseDetail.student_last_name}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Grade: </span>
            <span className="text-gray-900">{caseDetail.student_grade}</span>
          </div>
          <div>
            <span className="text-gray-500">SSID: </span>
            <span className="text-gray-900">{ssid || "Not provided"}</span>
          </div>
          <div>
            <span className="text-gray-500">Referral: </span>
            <span className="text-gray-900">{referralType === "initial" ? "Initial" : "Follow-up"}</span>
          </div>
        </div>
      </div>

      {/* Narrative preview */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Narrative</h4>
        {hasNarrative ? (
          <p className="text-sm text-gray-700 line-clamp-4">{narrative.slice(0, 300)}{narrative.length > 300 ? "..." : ""}</p>
        ) : (
          <p className="text-sm text-amber-600 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> No narrative provided
          </p>
        )}
      </div>

      {/* Documents summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Documents</h4>
        <div className="space-y-1">
          {components.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-sm">
              {c.status !== "not_started" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-gray-300" />
              )}
              <span className={c.status !== "not_started" ? "text-gray-700" : "text-gray-400"}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Attendees summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Attendees ({attendees.filter((a) => a.name.trim()).length})
        </h4>
        {attendees.filter((a) => a.name.trim()).length > 0 ? (
          <div className="space-y-1">
            {attendees.filter((a) => a.name.trim()).map((a) => (
              <p key={a.id} className="text-sm text-gray-700">
                {a.name}{a.role ? ` \u2014 ${a.role}` : ""}{a.title ? ` (${a.title})` : ""}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No attendees added</p>
        )}
      </div>

      {/* Special Ed Notes */}
      {specialEdNotes && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Special Education Notes</h4>
          <p className="text-sm text-gray-700">{specialEdNotes}</p>
        </div>
      )}

      {/* Validation warnings */}
      {(!requiredComplete || !hasNarrative) && (
        <div className="bg-amber-50 rounded-lg p-3 space-y-1">
          {!hasNarrative && (
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Narrative summary is required
            </p>
          )}
          {!requiredComplete && (
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Not all required documents are ready
            </p>
          )}
        </div>
      )}
    </div>
  );
}
