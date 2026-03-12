import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  School,
  AlertCircle,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { formatDate, type Brief } from "@/hooks/useBriefs";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function attendanceWorksClass(chronicRate: number): string {
  if (chronicRate >= 30) return "Extreme";
  if (chronicRate >= 20) return "High";
  if (chronicRate >= 10) return "Significant";
  if (chronicRate >= 5) return "Modest";
  return "Satisfactory";
}

function classificationColor(cls: string): string {
  switch (cls) {
    case "Extreme":
      return "text-red-700 bg-red-50 border-red-200";
    case "High":
      return "text-red-600 bg-red-50 border-red-100";
    case "Significant":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "Modest":
      return "text-amber-600 bg-amber-50 border-amber-100";
    default:
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function BriefCard({ brief }: { brief: Brief }) {
  const [expanded, setExpanded] = useState(false);
  const m = brief.metrics_snapshot;
  const cls = attendanceWorksClass(m.chronicRate);
  const flagged = brief.students_flagged ?? [];
  const overdueStudents = flagged.filter((s) => s.reason === "overdue_action");
  const elevatedStudents = flagged.filter((s) => s.reason === "elevated_risk");

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <School size={18} className="text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {m.schoolName}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">
                {formatDate(brief.brief_date)}
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded border",
                  classificationColor(cls)
                )}
              >
                {cls}
              </span>
              <span className="text-xs text-slate-400">
                {m.chronicCount} chronic · {m.elevatedCount} elevated
              </span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>

      {/* Body — expanded */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Narrative */}
          <div className="px-5 py-4">
            <div className="text-sm text-slate-700 leading-relaxed space-y-3">
              {brief.narrative
                .split("\n\n")
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p key={i}>{p.trim()}</p>
                ))}
            </div>
          </div>

          {/* Students needing attention */}
          {flagged.length > 0 && (
            <div className="px-5 pb-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Students Needing Attention
                </p>

                {overdueStudents.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {overdueStudents.map((s, i) => (
                      <div
                        key={`od-${i}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <AlertCircle
                          size={14}
                          className="text-red-400 mt-0.5 shrink-0"
                        />
                        <span className="text-slate-700">
                          <span className="font-medium">
                            {s.firstName} {s.lastName}
                          </span>{" "}
                          — {s.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {elevatedStudents.length > 0 && (
                  <div className="space-y-1.5">
                    {elevatedStudents.map((s, i) => (
                      <div
                        key={`el-${i}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <AlertTriangle
                          size={14}
                          className="text-amber-400 mt-0.5 shrink-0"
                        />
                        <span className="text-slate-700">
                          <span className="font-medium">
                            {s.firstName} {s.lastName}
                          </span>{" "}
                          — {s.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trust signal */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-1.5">
              <Shield size={12} className="text-slate-300 shrink-0" />
              <p className="text-xs text-slate-400">
                Generated from aggregate metrics only. No student names are
                processed by AI.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
