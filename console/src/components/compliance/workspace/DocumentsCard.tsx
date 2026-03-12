import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Lock,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
} from "lucide-react";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";
import type { DocumentRecord } from "@/types/caseWorkspace";
import { TierLetterGenerationModal } from "./TierLetterGenerationModal";
import { ConferenceSummaryModal } from "./ConferenceSummaryModal";
import { generateAttendanceRecord } from "@/services/compliance/generateAttendanceRecord";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  documents: DocumentRecord[];
  workspaceData: CaseWorkspaceResponse;
  permissions: CaseWorkspaceResponse["permissions"];
  onDocumentGenerated: () => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function tierCheckCompleted(
  checklist: CaseWorkspaceResponse["tierChecklist"],
  tier: "tier1" | "tier2",
  key: string
): boolean {
  const items = checklist[tier];
  const item = items.find((i) => i.key === key);
  return !!item?.completed;
}

/* ------------------------------------------------------------------ */
/* Document Row Types                                                  */
/* ------------------------------------------------------------------ */

type StatusInfo = { status: "ready" | "generated" | "blocked"; reason?: string; date?: string };

type DocAction =
  | "generate_letter"
  | "generate_conference_summary"
  | "generate_attendance_record"
  | "coming_soon";

type DocRowConfig = {
  id: string;
  label: string;
  docType: string;
  getStatus: (
    docs: DocumentRecord[],
    checklist: CaseWorkspaceResponse["tierChecklist"]
  ) => StatusInfo;
  buttonLabel: string;
  action: DocAction;
};

function getDocRows(): DocRowConfig[] {
  return [
    {
      id: "tier1_notification",
      label: "Tier 1 Notification Letter",
      docType: "tier1_notification",
      getStatus: (docs) => {
        const doc = docs.find((d) => d.docType === "tier1_notification");
        if (doc) return { status: "generated", date: doc.generatedAt };
        return { status: "ready" };
      },
      buttonLabel: "Generate",
      action: "generate_letter",
    },
    {
      id: "conference_summary",
      label: "Conference Summary",
      docType: "tier2_conference_summary",
      getStatus: (docs, checklist) => {
        const held = tierCheckCompleted(checklist, "tier2", "conference_held");
        if (!held) {
          return { status: "blocked", reason: "Conference not yet documented" };
        }
        const doc = docs.find((d) => d.docType === "tier2_conference_summary");
        if (doc) return { status: "generated", date: doc.generatedAt };
        return { status: "ready" };
      },
      buttonLabel: "Generate",
      action: "generate_conference_summary",
    },
    {
      id: "interventions_log",
      label: "SART Interventions Log",
      docType: "interventions_log",
      getStatus: (docs) => {
        const doc = docs.find((d) => d.docType === "interventions_log");
        if (doc) return { status: "generated", date: doc.generatedAt };
        return { status: "ready" };
      },
      buttonLabel: "Generate",
      action: "coming_soon",
    },
    {
      id: "attendance_record",
      label: "Attendance Record",
      docType: "attendance_record",
      getStatus: (docs) => {
        const doc = docs.find((d) => d.docType === "attendance_record");
        if (doc) return { status: "generated", date: doc.generatedAt };
        return { status: "ready" };
      },
      buttonLabel: "Generate",
      action: "generate_attendance_record",
    },
    {
      id: "sarb_packet",
      label: "SARB Referral Packet",
      docType: "tier3_sarb_packet",
      getStatus: (_docs, checklist) => {
        const blockedReasons: string[] = [];
        const t1Notif = tierCheckCompleted(checklist, "tier1", "notification_sent");
        const t2Conf = tierCheckCompleted(checklist, "tier2", "conference_held");
        if (!t1Notif) blockedReasons.push("Tier 1 notification not sent");
        if (!t2Conf) blockedReasons.push("Tier 2 conference not held");
        if (blockedReasons.length > 0) {
          return { status: "blocked", reason: blockedReasons.join("; ") };
        }
        return { status: "ready" };
      },
      buttonLabel: "Assemble Packet",
      action: "coming_soon",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Document Row Component                                              */
/* ------------------------------------------------------------------ */

function DocumentRow({
  config,
  statusInfo,
  canGenerate,
  isLoading,
  onAction,
}: {
  config: DocRowConfig;
  statusInfo: StatusInfo;
  canGenerate: boolean;
  isLoading: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="shrink-0">
        {statusInfo.status === "generated" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : statusInfo.status === "blocked" ? (
          <Lock className="h-4 w-4 text-gray-300" />
        ) : (
          <FileText className="h-4 w-4 text-gray-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            statusInfo.status === "blocked" ? "text-gray-400" : "text-gray-900"
          )}
        >
          {config.label}
        </p>
        {statusInfo.status === "generated" && statusInfo.date && (
          <p className="text-xs text-gray-400 mt-0.5">
            Generated {formatDate(statusInfo.date)}
          </p>
        )}
        {statusInfo.status === "blocked" && statusInfo.reason && (
          <p className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {statusInfo.reason}
          </p>
        )}
      </div>

      {statusInfo.status !== "blocked" && canGenerate && (
        <button
          onClick={onAction}
          disabled={isLoading}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          {statusInfo.status === "generated" ? "Regenerate" : config.buttonLabel}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Generated Documents Table                                           */
/* ------------------------------------------------------------------ */

function GeneratedDocumentsTable({ documents }: { documents: DocumentRecord[] }) {
  if (documents.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-2 text-center">
        No documents generated yet
      </p>
    );
  }

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Generated Documents
      </h4>
      <div className="space-y-1.5">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center gap-2 py-1.5 text-xs">
            <Download className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-gray-700 truncate flex-1">{doc.title}</span>
            <span className="text-gray-400 shrink-0">
              {doc.docType.replace(/_/g, " ")}
            </span>
            {doc.sentAt ? (
              <span className="text-emerald-600 shrink-0 flex items-center gap-1">
                <Send className="h-3 w-3" />
                {formatDate(doc.sentAt)}
                {doc.sentMethod && (
                  <span className="text-gray-400">
                    via {doc.sentMethod.replace(/_/g, " ")}
                  </span>
                )}
                {doc.deliveryConfirmed && (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                )}
              </span>
            ) : (
              <span className="text-gray-400 shrink-0 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(doc.generatedAt)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function DocumentsCard({
  caseId,
  documents,
  workspaceData,
  permissions,
  onDocumentGenerated,
}: Props) {
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [showConferenceModal, setShowConferenceModal] = useState(false);
  const [generatingAttendance, setGeneratingAttendance] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const docRows = getDocRows();
  const canGenerate = permissions.canGenerateDocuments;

  const handleAction = async (config: DocRowConfig) => {
    if (config.action === "generate_letter") {
      setShowLetterModal(true);
    } else if (config.action === "generate_conference_summary") {
      setShowConferenceModal(true);
    } else if (config.action === "generate_attendance_record") {
      setGeneratingAttendance(true);
      try {
        const result = await generateAttendanceRecord(caseId, workspaceData);
        if (result.success) {
          onDocumentGenerated();
        } else {
          setToast(result.error ?? "Failed to generate");
          setTimeout(() => setToast(null), 3000);
        }
      } catch {
        setToast("Failed to generate attendance record");
        setTimeout(() => setToast(null), 3000);
      } finally {
        setGeneratingAttendance(false);
      }
    } else {
      setToast("Coming in next build");
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-lg p-2 bg-emerald-50">
            <FileText className="h-4 w-4 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Documents</h3>
        </div>

        <div>
          {docRows.map((config) => {
            const statusInfo = config.getStatus(
              documents,
              workspaceData.tierChecklist
            );
            return (
              <DocumentRow
                key={config.id}
                config={config}
                statusInfo={statusInfo}
                canGenerate={canGenerate}
                isLoading={
                  config.action === "generate_attendance_record" && generatingAttendance
                }
                onAction={() => handleAction(config)}
              />
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <GeneratedDocumentsTable documents={documents} />
        </div>

        {toast && (
          <div className="mt-3 px-3 py-2 bg-gray-100 rounded-lg text-xs text-gray-600 text-center animate-in fade-in">
            {toast}
          </div>
        )}
      </div>

      {showLetterModal && (
        <TierLetterGenerationModal
          caseId={caseId}
          workspaceData={workspaceData}
          isOpen={showLetterModal}
          onClose={() => setShowLetterModal(false)}
          onSuccess={onDocumentGenerated}
        />
      )}

      {showConferenceModal && (
        <ConferenceSummaryModal
          caseId={caseId}
          workspaceData={workspaceData}
          isOpen={showConferenceModal}
          onClose={() => setShowConferenceModal(false)}
          onSuccess={() => {
            setShowConferenceModal(false);
            onDocumentGenerated();
          }}
        />
      )}
    </>
  );
}
