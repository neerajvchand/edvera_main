import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { ComplianceCase } from "@/hooks/useStudentDetail";
import { SHORT_TIER_LABELS, fmtShortDate } from "@/hooks/useStudentDetail";

const TIER_COLORS: Record<string, string> = {
  tier_1_letter: "bg-amber-50 text-amber-700 border-amber-200",
  tier_2_conference: "bg-orange-50 text-orange-700 border-orange-200",
  tier_3_sarb_referral: "bg-red-50 text-red-700 border-red-200",
};

export function StudentComplianceCases({ cases }: { cases: ComplianceCase[] }) {
  if (cases.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
      <h2 className="text-base font-semibold text-slate-900 mb-3">Compliance Cases</h2>
      <div className="space-y-2">
        {cases.map((c) => (
          <Link
            key={c.id}
            to={`/compliance/cases/${c.id}`}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={cn(
                  "text-xs font-medium px-2.5 py-0.5 rounded-full border shrink-0",
                  TIER_COLORS[c.current_tier] ?? "bg-gray-50 text-gray-600 border-gray-200"
                )}
              >
                {SHORT_TIER_LABELS[c.current_tier] ?? c.current_tier}
              </span>
              <span className="text-sm text-slate-600 truncate">
                Opened {fmtShortDate(c.created_at.slice(0, 10))}
                {" · "}
                {c.unexcused_absence_count} unexcused
                {c.is_resolved && (
                  <span className="ml-2 text-emerald-600 font-medium">Resolved</span>
                )}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
