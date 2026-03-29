import { cn } from "@/lib/utils";
import {
  Loader2,
  Check,
  Circle,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { fmtDate, type PacketComponent } from "@/hooks/useSarbPacket";

export function SarbPacketStepDocuments({
  components,
  generatingDocKey,
  onGenerateInterventionsLog,
  onGenerateSarbPacket,
  onMarkReady,
}: {
  components: PacketComponent[];
  generatingDocKey: string | null;
  onGenerateInterventionsLog: () => void;
  onGenerateSarbPacket: () => void;
  onMarkReady: (key: string) => void;
}) {
  const completedCount = components.filter((c) => c.status !== "not_started").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Verify all required documents are included in the packet.
        </p>
        <span className="text-xs font-medium text-gray-400">
          {completedCount}/{components.length} complete
        </span>
      </div>

      <div className="space-y-2">
        {components.map((comp) => {
          const isGenerating = generatingDocKey === comp.key;
          return (
            <div
              key={comp.key}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                comp.status !== "not_started"
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {comp.status !== "not_started" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-300" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{comp.label}</p>
                    {comp.status !== "not_started" && comp.generatedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {comp.status === "generated" ? "Generated" : "Uploaded"} {fmtDate(comp.generatedAt.slice(0, 10))}
                      </p>
                    )}
                    {comp.required && comp.status === "not_started" && (
                      <p className="text-xs text-amber-600 mt-0.5">Required</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Generate button for specific types */}
                  {comp.key === "interventions_log" && (
                    <button
                      onClick={onGenerateInterventionsLog}
                      disabled={isGenerating}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      Generate
                    </button>
                  )}
                  {comp.key === "attendance_record" && (
                    <button
                      onClick={onGenerateSarbPacket}
                      disabled={isGenerating}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      Generate
                    </button>
                  )}
                  {/* Mark as uploaded button for any */}
                  {comp.status === "not_started" && (
                    <button
                      onClick={() => onMarkReady(comp.key)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Mark Ready
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {completedCount < components.filter((c) => c.required).length && (
        <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            All required documents must be included before the packet can be finalized.
          </p>
        </div>
      )}
    </div>
  );
}
