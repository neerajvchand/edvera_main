import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type {
  StudentBasic,
  Snapshot,
  RiskSignal,
  ComplianceCase,
} from "@/hooks/useStudentDetail";
import { SHORT_TIER_LABELS } from "@/hooks/useStudentDetail";

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

function attendanceBand(rate: number): { label: string; color: string; bgColor: string } {
  if (rate >= 95) return { label: "Satisfactory", color: "text-emerald-700", bgColor: "bg-emerald-50" };
  if (rate >= 90) return { label: "At Risk", color: "text-amber-700", bgColor: "bg-amber-50" };
  if (rate >= 80) return { label: "Chronic", color: "text-red-600", bgColor: "bg-red-50" };
  return { label: "Severe Chronic", color: "text-red-700", bgColor: "bg-red-100" };
}

function rateColor(rate: number): string {
  if (rate >= 95) return "text-emerald-600";
  if (rate >= 90) return "text-amber-600";
  return "text-red-600";
}

function signalBadge(level: string): { label: string; cls: string } {
  switch (level) {
    case "elevated":
      return { label: "Elevated", cls: "bg-red-50 text-red-700 border-red-200" };
    case "softening":
      return { label: "Softening", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "stable":
      return { label: "Stable", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    default:
      return { label: "Pending", cls: "bg-slate-50 text-slate-600 border-slate-200" };
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function StudentDetailHeader({
  student,
  snapshot,
  signal,
  complianceCase,
}: {
  student: StudentBasic;
  snapshot: Snapshot | null;
  signal: RiskSignal | null;
  complianceCase: ComplianceCase | null;
}) {
  const band = snapshot ? attendanceBand(snapshot.attendance_rate) : null;
  const badge = signal ? signalBadge(signal.signal_level) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* LEFT — Name */}
        <div className="lg:min-w-[200px]">
          <h1 className="text-2xl font-semibold text-slate-900">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Grade {student.grade_level} &middot; {student.school?.name ?? "Unknown"}
          </p>
        </div>

        {/* CENTER — Stats */}
        {snapshot && (
          <div className="flex items-center gap-6 lg:gap-8 flex-1 justify-center">
            <div className="text-center">
              <p className={cn("text-2xl font-bold tabular-nums", rateColor(snapshot.attendance_rate))}>
                {snapshot.attendance_rate.toFixed(1)}%
              </p>
              {band && (
                <span className={cn("inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1", band.color, band.bgColor)}>
                  {band.label}
                </span>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">Attendance Rate</p>
            </div>

            <div className="w-px h-10 bg-slate-200 hidden sm:block" />

            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-900">
                {snapshot.days_absent}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ({snapshot.days_absent_excused} excused, {snapshot.days_absent_unexcused} unexcused)
              </p>
              <p className="text-[11px] text-slate-400">Absences</p>
            </div>

            <div className="w-px h-10 bg-slate-200 hidden sm:block" />

            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-900">
                {snapshot.days_enrolled}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Days Enrolled</p>
            </div>
          </div>
        )}

        {/* RIGHT — Risk + Compliance */}
        <div className="flex flex-col items-end gap-2 lg:min-w-[160px]">
          {badge && (
            <span className={cn("text-xs font-medium px-3 py-1 rounded-full border", badge.cls)}>
              {badge.label}
            </span>
          )}
          {complianceCase && complianceCase.current_tier !== "none" && !complianceCase.is_resolved && (
            <Link
              to={`/compliance/cases/${complianceCase.id}`}
              className="text-xs font-medium px-3 py-1 rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              {SHORT_TIER_LABELS[complianceCase.current_tier] ?? complianceCase.current_tier}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
