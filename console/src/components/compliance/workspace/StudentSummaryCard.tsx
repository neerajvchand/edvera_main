import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const BAND_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  satisfactory: { label: "Satisfactory", bg: "bg-emerald-50", text: "text-emerald-700" },
  "at-risk": { label: "At Risk", bg: "bg-yellow-50", text: "text-yellow-700" },
  moderate: { label: "Moderate", bg: "bg-orange-50", text: "text-orange-700" },
  severe: { label: "Severe", bg: "bg-red-50", text: "text-red-700" },
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  metrics: CaseWorkspaceResponse["metrics"];
  caseData: CaseWorkspaceResponse["case"];
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "\u2014";
  return `${val.toFixed(1)}%`;
}

export function StudentSummaryCard({ metrics, caseData }: Props) {
  const m = metrics;
  const band = BAND_STYLES[m.chronicBand] ?? BAND_STYLES.satisfactory;

  const rateColor =
    m.attendanceRate < 90
      ? "text-red-600"
      : m.attendanceRate < 95
        ? "text-orange-500"
        : "text-emerald-600";

  const hasTrend =
    m.thirtyDayRate !== null && m.priorThirtyDayRate !== null;
  const trendUp =
    hasTrend && m.thirtyDayRate! >= m.priorThirtyDayRate!;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        {caseData.studentName}
      </h3>

      {/* Attendance rate */}
      <div className="text-center mb-4">
        <p className={cn("text-4xl font-bold tabular-nums", rateColor)}>
          {fmtPct(m.attendanceRate)}
        </p>
        <p className="text-xs text-gray-500 mt-1">Attendance Rate</p>
        <span
          className={cn(
            "inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-2",
            band.bg,
            band.text
          )}
        >
          {band.label}
        </span>
      </div>

      {/* Stats grid 2x3 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCell label="Days Enrolled" value={m.daysEnrolled} />
        <StatCell label="Total Absences" value={m.totalAbsences} />
        <StatCell label="Unexcused" value={m.unexcusedAbsences} />
        <StatCell label="Excused" value={m.excusedAbsences} />
        <StatCell label="Tardies" value={m.tardies} />
        <StatCell label="Truancy Count" value={m.truancyCount} />
      </div>

      {/* 30-day trend */}
      {hasTrend && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg">
          <span className="text-xs text-gray-500">30-day trend</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium tabular-nums text-gray-900">
              {fmtPct(m.thirtyDayRate)}
            </span>
            <span className="text-xs text-gray-400">vs prior</span>
            <span className="text-sm font-medium tabular-nums text-gray-900">
              {fmtPct(m.priorThirtyDayRate)}
            </span>
            {trendUp ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {caseData.schoolName} &middot; Grade {caseData.grade}
        </p>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-lg font-semibold text-gray-900 tabular-nums mt-0.5">
        {value}
      </p>
    </div>
  );
}
