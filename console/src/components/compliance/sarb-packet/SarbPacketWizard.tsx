import { cn } from "@/lib/utils";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  Download,
} from "lucide-react";
import {
  useSarbPacket,
  SARB_STEPS,
  type CaseDetailForModal,
} from "@/hooks/useSarbPacket";
import { SarbPacketStepStudentInfo } from "./SarbPacketStepStudentInfo";
import { SarbPacketStepNarrative } from "./SarbPacketStepNarrative";
import { SarbPacketStepDocuments } from "./SarbPacketStepDocuments";
import { SarbPacketStepAttendees } from "./SarbPacketStepAttendees";
import { SarbPacketStepReview } from "./SarbPacketStepReview";

export function SarbPacketWizard({
  caseDetail,
  onClose,
  onSaved,
}: {
  caseDetail: CaseDetailForModal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pkt = useSarbPacket(caseDetail, onSaved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">SARB Packet Assembly</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {caseDetail.student_first_name} {caseDetail.student_last_name} — {caseDetail.school_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-1">
            {SARB_STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <button
                  onClick={() => pkt.setStep(s.num)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    pkt.step === s.num
                      ? "bg-emerald-50 text-emerald-700"
                      : pkt.step > s.num
                        ? "text-emerald-600 hover:bg-emerald-50/50"
                        : "text-gray-400"
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    pkt.step === s.num
                      ? "bg-emerald-600 text-white"
                      : pkt.step > s.num
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-200 text-gray-500"
                  )}>
                    {pkt.step > s.num ? <Check className="h-3 w-3" /> : s.num}
                  </span>
                  {s.label}
                </button>
                {i < SARB_STEPS.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-gray-300 mx-0.5 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {pkt.step === 1 && (
            <SarbPacketStepStudentInfo caseDetail={caseDetail} ssid={pkt.ssid} setSsid={pkt.setSsid} referralType={pkt.referralType} setReferralType={pkt.setReferralType} specialEdNotes={pkt.specialEdNotes} setSpecialEdNotes={pkt.setSpecialEdNotes} />
          )}
          {pkt.step === 2 && (
            <SarbPacketStepNarrative narrative={pkt.narrative} setNarrative={pkt.setNarrative} generating={pkt.generatingNarrative} onGenerate={pkt.generateNarrative} />
          )}
          {pkt.step === 3 && (
            <SarbPacketStepDocuments components={pkt.components} generatingDocKey={pkt.generatingDocKey} onGenerateInterventionsLog={pkt.generateInterventionsLog} onGenerateSarbPacket={pkt.generateSarbPacketDoc} onMarkReady={pkt.markComponentReady} />
          )}
          {pkt.step === 4 && (
            <SarbPacketStepAttendees attendees={pkt.attendees} setAttendees={pkt.setAttendees} />
          )}
          {pkt.step === 5 && (
            <SarbPacketStepReview caseDetail={caseDetail} ssid={pkt.ssid} referralType={pkt.referralType} narrative={pkt.narrative} components={pkt.components} attendees={pkt.attendees} specialEdNotes={pkt.specialEdNotes} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            {pkt.step > 1 && (
              <button onClick={() => pkt.setStep(pkt.step - 1)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => pkt.savePacket("draft")} disabled={pkt.saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              Save Draft
            </button>
            {pkt.step < 5 ? (
              <button onClick={() => pkt.setStep(pkt.step + 1)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={pkt.downloadFullPacket} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                  <Download className="h-4 w-4" /> Download PDF
                </button>
                <button onClick={() => pkt.savePacket("submitted")} disabled={pkt.saving || !pkt.canFinalize} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed">
                  {pkt.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {pkt.saving ? "Saving..." : "Mark as Submitted"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
