import type { DashboardMetrics } from "@/hooks/useDashboard";
import { CARD, SECTION_LABEL } from "@/lib/designTokens";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  text: string;
  time: string;
}

interface BottomPanelsProps {
  schools: DashboardMetrics["schoolBreakdown"];
  complianceCasesOpen: number;
  auditTrail: AuditEntry[];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function BottomPanels({
  schools,
  complianceCasesOpen,
  auditTrail,
}: BottomPanelsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Cases by school */}
      <div className={`${CARD} p-3`}>
        <h3 className={`${SECTION_LABEL} mb-2`}>
          Cases by school
        </h3>
        {schools.length === 0 ? (
          <p className="text-[11px] text-gray-400">No school data.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {schools.map((school) => (
              <div
                key={school.name}
                className="flex justify-between py-1.5 text-[11px]"
              >
                <span className="text-gray-500">{school.name}</span>
                <span className="font-medium text-gray-900">
                  {school.elevated > 0
                    ? `${school.elevated} elevated`
                    : `${school.chronicRate.toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit trail */}
      <div className={`${CARD} p-3`}>
        <h3 className={`${SECTION_LABEL} mb-2`}>
          Audit trail
        </h3>
        {auditTrail.length === 0 ? (
          <p className="text-[11px] text-gray-400">No recent activity.</p>
        ) : (
          <div className="space-y-1">
            {auditTrail.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span className="text-[11px] text-gray-500 flex-1">
                  {entry.text}
                </span>
                <span className="text-[10px] text-gray-300 shrink-0 whitespace-nowrap">
                  {entry.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
