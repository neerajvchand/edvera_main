/**
 * Composite report data service.
 *
 * Composes the focused report services into the single `ReportData`
 * shape expected by `buildDistrictReportPdf`. New code should prefer
 * the individual services in this directory.
 *
 * Re-exports types and constants for backwards compatibility.
 */
import { getAttendanceOverview, DAILY_RATE } from "@/services/reports/getAttendanceOverview";
import { getComplianceStatusReport } from "@/services/reports/getComplianceStatusReport";
import { getTruancyTrendReport } from "@/services/reports/getTruancyTrendReport";
import { getDistrictName } from "@/services/schools/getDistrictName";
import { handleServiceError } from "@/services/serviceError";
import type { ReportData, ReportPeriod } from "@/types/reports";

/* ------------------------------------------------------------------ */
/* Re-exports (backwards compatibility)                                */
/* ------------------------------------------------------------------ */

export type { ReportData, ReportPeriod };
export type { SchoolAttendanceRow as SchoolRow } from "@/types/reports";
export { DAILY_RATE };

export const TEACHER_SALARY = 85_000;

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  ytd: "Year to Date",
  semester: "This Semester",
  quarter: "This Quarter",
  last30: "Last 30 Days",
};

/* ------------------------------------------------------------------ */
/* Composite fetch                                                     */
/* ------------------------------------------------------------------ */

export async function fetchReportData(): Promise<ReportData> {
  try {
    const [attendance, compliance, truancy, districtName] = await Promise.all([
      getAttendanceOverview(),
      getComplianceStatusReport(),
      getTruancyTrendReport(),
      getDistrictName().catch(() => "District"),
    ]);

    const chronicStudents = attendance.schools.reduce(
      (s, r) => s + r.chronicCount,
      0
    );

    return {
      districtName,
      totalStudents: attendance.totalStudents,
      chronicRate: attendance.chronicRate,
      projectedLoss: attendance.projectedLoss,
      studentsRequiringIntervention: truancy.studentsRequiringIntervention,
      elevatedCount: truancy.elevatedCount,
      softeningCount: truancy.softeningCount,
      schools: attendance.schools,
      tier1Count: compliance.tier1Count,
      tier2Count: compliance.tier2Count,
      tier3Count: compliance.tier3Count,
      actionsCompletedCount: compliance.actionsCompletedCount,
      actionsOverdueCount: compliance.actionsOverdueCount,
      bandSatisfactory: attendance.bands.satisfactory,
      bandAtRisk: attendance.bands.atRisk,
      bandModerate: attendance.bands.moderate,
      bandSevere: attendance.bands.severe,
      bandAcute: attendance.bands.acute,
      severeOrAcuteCount: truancy.severeOrAcuteCount,
      unexcusedRate: attendance.unexcusedRate,
      newlyChronicCount: chronicStudents,
    };
  } catch (err) {
    throw handleServiceError("load report data", err);
  }
}
