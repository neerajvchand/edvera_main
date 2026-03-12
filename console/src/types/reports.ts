/* ------------------------------------------------------------------ */
/* Report Types                                                        */
/*                                                                     */
/* Shaped for chart/UI consumption — not raw database rows.            */
/* Each report service returns one of these types.                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Attendance Overview                                                 */
/* ------------------------------------------------------------------ */

/** Per-school attendance summary row. */
export interface SchoolAttendanceRow {
  id: string;
  name: string;
  students: number;
  chronicCount: number;
  chronicRate: number;
  projectedLoss: number;
}

/** Attendance band counts for stacked-bar / donut charts. */
export interface AttendanceBandDistribution {
  satisfactory: number;
  atRisk: number;
  moderate: number;
  severe: number;
  acute: number;
}

/** Top-level attendance overview for the district. */
export interface AttendanceOverviewData {
  totalStudents: number;
  chronicRate: number;
  projectedLoss: number;
  unexcusedRate: number;
  bands: AttendanceBandDistribution;
  schools: SchoolAttendanceRow[];
}

/* ------------------------------------------------------------------ */
/* Chronic Absentee Report                                             */
/* ------------------------------------------------------------------ */

/** One row per school with chronic-absence detail. */
export interface ChronicAbsenteeRow {
  schoolId: string;
  schoolName: string;
  totalStudents: number;
  chronicCount: number;
  chronicRate: number;
  newlyChronicCount: number;
  projectedLoss: number;
}

/* ------------------------------------------------------------------ */
/* Compliance Status Report                                            */
/* ------------------------------------------------------------------ */

/** Compliance tier counts and action stats. */
export interface ComplianceStatusData {
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  totalOpenCases: number;
  actionsCompletedCount: number;
  actionsOverdueCount: number;
}

/* ------------------------------------------------------------------ */
/* Truancy Trend Report                                                */
/* ------------------------------------------------------------------ */

/** Risk-signal counts for intervention tracking. */
export interface TruancyTrendData {
  elevatedCount: number;
  softeningCount: number;
  studentsRequiringIntervention: number;
  severeOrAcuteCount: number;
}

/* ------------------------------------------------------------------ */
/* SARB Referral Report                                                */
/* ------------------------------------------------------------------ */

/** SARB referral summary (tier-3 cases). */
export interface SarbReferralData {
  tier3Count: number;
  /** Same as ComplianceStatusData.tier3Count; included for standalone use. */
}

/* ------------------------------------------------------------------ */
/* Composite / Legacy                                                  */
/* ------------------------------------------------------------------ */

/**
 * Composite report data used by the PDF builder.
 *
 * This type composes the individual report types into a single flat
 * structure expected by `buildDistrictReportPdf`. New chart components
 * should prefer the individual types above.
 */
export interface ReportData {
  districtName: string;
  totalStudents: number;
  chronicRate: number;
  projectedLoss: number;
  studentsRequiringIntervention: number;
  elevatedCount: number;
  softeningCount: number;
  schools: SchoolAttendanceRow[];
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  actionsCompletedCount: number;
  actionsOverdueCount: number;
  bandSatisfactory: number;
  bandAtRisk: number;
  bandModerate: number;
  bandSevere: number;
  bandAcute: number;
  severeOrAcuteCount: number;
  unexcusedRate: number;
  newlyChronicCount: number;
}

/** Report period selector values. */
export type ReportPeriod = "ytd" | "semester" | "quarter" | "last30";
