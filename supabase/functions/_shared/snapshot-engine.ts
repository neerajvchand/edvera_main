/**
 * Pure computation engine for attendance snapshots.
 *
 * Zero runtime dependencies — takes plain data in, returns plain results out.
 * All California Ed Code classification logic lives here so it can be
 * unit-tested without Supabase, Deno, or any other platform dependency.
 *
 * @module snapshot-engine
 */

/* ------------------------------------------------------------------ */
/* Input types                                                         */
/* ------------------------------------------------------------------ */

/** A single row from the attendance_daily table. */
export interface AttendanceRecord {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /**
   * The canonical absence type from the absence_type enum.
   * One of: present, absent_unverified, absent_excused, absent_unexcused,
   * tardy, tardy_excused, tardy_unexcused, suspension_in_school,
   * suspension_out_of_school, independent_study_complete,
   * independent_study_incomplete, not_enrolled.
   */
  canonical_type: string;
  /** Whether this day counts toward Average Daily Attendance funding. */
  counts_for_ada: boolean;
  /** Whether this record counts as a truancy event per EC §48260. */
  counts_as_truancy: boolean;
}

/** A single row from the school_calendars table. */
export interface CalendarDay {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Whether this is an instructional school day (true) or non-school day (false). */
  is_school_day: boolean;
}

/** Input parameters for computing a single student's attendance snapshot. */
export interface SnapshotInput {
  studentId: string;
  schoolId: string;
  academicYear: string;
  /** ISO date string — the student's enrollment start date (enrollments.enter_date). */
  enrollmentDate: string;
  /** ISO date string or null — the student's enrollment end date (enrollments.leave_date). */
  leaveDate: string | null;
  /** All attendance_daily records for this student in the academic year. */
  attendanceRecords: AttendanceRecord[];
  /** All calendar days for this student's school in the academic year. */
  calendarDays: CalendarDay[];
  /** ISO date string — the "as of" date for this snapshot (usually today). */
  today: string;
}

/* ------------------------------------------------------------------ */
/* Output type                                                         */
/* ------------------------------------------------------------------ */

/** Computed attendance snapshot for a single student. */
export interface SnapshotResult {
  student_id: string;
  school_id: string;
  academic_year: string;
  /** The date this snapshot was computed for (usually today). */
  snapshot_date: string;

  /* --- Day counts --- */

  /**
   * Count of instructional calendar days between enrollment date and today
   * (or leave_date, whichever is earlier). This is the denominator for
   * all rate calculations.
   */
  days_enrolled: number;

  /**
   * Days the student was marked present. Includes: present, tardy,
   * tardy_excused, tardy_unexcused, independent_study_complete.
   * Tardies count as present because the student attended school that day.
   */
  days_present: number;

  /**
   * Days the student was absent (all types). Includes: absent_unverified,
   * absent_excused, absent_unexcused, suspension_in_school,
   * suspension_out_of_school, independent_study_incomplete.
   * Per CA Ed Code §60901, ALL absence types count toward chronic absence.
   */
  days_absent: number;

  /** Absent days classified as excused (absent_excused only). */
  days_absent_excused: number;

  /** Absent days classified as unexcused (absent_unexcused only). */
  days_absent_unexcused: number;

  /** Days marked tardy (tardy, tardy_excused, tardy_unexcused). */
  days_tardy: number;

  /**
   * Count of records where counts_as_truancy = true.
   * Maps to truancy events per EC §48260 (3+ unexcused absences or
   * tardies exceeding 30 minutes).
   */
  days_truant: number;

  /** Days under any suspension (in-school + out-of-school). */
  days_suspended: number;

  /** Days under in-school suspension specifically. */
  days_suspended_in_school: number;

  /** Days on independent study where work was completed (counts as present). */
  days_independent_study_complete: number;

  /** Days on independent study where work was NOT completed (counts as absent). */
  days_independent_study_incomplete: number;

  /* --- Rates (1 decimal place) --- */

  /**
   * (days_present / days_enrolled) * 100, rounded to 1 decimal.
   * This is the primary attendance metric shown on the console dashboard.
   */
  attendance_rate: number;

  /**
   * (days_absent / days_enrolled) * 100, rounded to 1 decimal.
   * Used for chronic absence classification and Attendance Works banding.
   */
  absence_rate: number;

  /**
   * (ada_eligible_days / days_enrolled) * 100, rounded to 1 decimal.
   * ADA rate reflects funding-eligible attendance. A student who is present
   * on a non-ADA day doesn't generate funding.
   */
  ada_rate: number;

  /* --- Classifications --- */

  /**
   * True if absence_rate >= 10.0%.
   * Per CA Education Code §60901(c)(1), a student is chronically absent
   * when they miss 10% or more of enrolled instructional days.
   */
  is_chronic_absent: boolean;

  /**
   * Attendance Works band classification based on absence_rate:
   * - "satisfactory"     → 0–5.9%
   * - "at_risk"          → 6–9.9%
   * - "moderate_chronic" → 10–19.9%
   * - "severe_chronic"   → 20–49.9%
   * - "acute_chronic"    → 50%+
   *
   * These bands are used in California LCAP reporting and the Dashboard
   * Alternative School Status (DASS) calculations.
   */
  attendance_band: string;

  /* --- Derived metrics --- */

  /**
   * Count of days where the student was present AND the day was marked
   * counts_for_ada = true. This is the numerator for ADA funding calculations.
   * Each ADA-eligible day generates approximately $65 in per-pupil funding.
   */
  ada_eligible_days: number;

  /**
   * Count of attendance records flagged as truancy events (counts_as_truancy = true).
   * EC §48260 defines a truant as a student with 3+ unexcused absences or
   * unexcused tardies in excess of 30 minutes in one school year.
   */
  truancy_count: number;
}

/* ------------------------------------------------------------------ */
/* Canonical type classification sets                                   */
/* ------------------------------------------------------------------ */

/**
 * Canonical types that count as the student being PRESENT for the day.
 * Tardies count as present — the student attended, just late.
 * Completed independent study counts as present — the work was done.
 */
const PRESENT_TYPES = new Set([
  "present",
  "tardy",
  "tardy_excused",
  "tardy_unexcused",
  "independent_study_complete",
]);

/**
 * Canonical types that count as the student being ABSENT for the day.
 * Per California's chronic absence definition (Ed Code §60901), ALL
 * absence types are included — excused, unexcused, suspensions, and
 * incomplete independent study.
 */
const ABSENT_TYPES = new Set([
  "absent_unverified",
  "absent_excused",
  "absent_unexcused",
  "suspension_in_school",
  "suspension_out_of_school",
  "independent_study_incomplete",
]);

/** Canonical types that count as tardy (subset of PRESENT). */
const TARDY_TYPES = new Set([
  "tardy",
  "tardy_excused",
  "tardy_unexcused",
]);

/** Canonical types that count as suspension (subset of ABSENT). */
const SUSPENSION_TYPES = new Set([
  "suspension_in_school",
  "suspension_out_of_school",
]);

/* ------------------------------------------------------------------ */
/* Attendance Works band classification                                */
/* ------------------------------------------------------------------ */

/**
 * Classifies a student into an Attendance Works band based on their
 * absence rate percentage.
 *
 * California uses these bands for LCAP reporting, school dashboard
 * indicators, and the CDE DataQuest chronic absence reports.
 *
 * @see https://www.attendanceworks.org/chronic-absence/the-problem/
 */
function classifyBand(absenceRate: number): string {
  if (absenceRate < 6) return "satisfactory";
  if (absenceRate < 10) return "at_risk";
  if (absenceRate < 20) return "moderate_chronic";
  if (absenceRate < 50) return "severe_chronic";
  return "acute_chronic";
}

/* ------------------------------------------------------------------ */
/* Core computation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Computes an attendance snapshot for a single student from raw records.
 *
 * This is the core calculation engine. It takes plain data objects with
 * zero runtime dependencies and produces a fully computed snapshot.
 *
 * **Enrollment window**: Only instructional calendar days between the
 * student's enter_date and today (or leave_date, whichever is earlier)
 * are counted toward days_enrolled. Non-school days (weekends, holidays,
 * teacher prep days) are excluded.
 *
 * **Chronic absence** (CA Education Code §60901(c)(1)): A student is
 * chronically absent if they miss 10% or more of enrolled instructional
 * days. ALL absence types count — excused, unexcused, and suspensions.
 * This is the key metric districts report to CDE.
 *
 * **ADA** (Average Daily Attendance): Only days where the student was
 * physically present AND the day was marked counts_for_ada = true
 * generate state funding. Each missed ADA day costs the district ~$65.
 *
 * **Edge case**: If days_enrolled = 0 (student just enrolled, no
 * instructional days yet, or enrollment period has no school days),
 * all rates are set to 0 and the band defaults to "satisfactory".
 *
 * @param params - Student data, attendance records, and calendar days
 * @returns Fully computed snapshot with all day counts, rates, and classifications
 */
export function computeSnapshot(params: SnapshotInput): SnapshotResult {
  const {
    studentId,
    schoolId,
    academicYear,
    enrollmentDate,
    leaveDate,
    attendanceRecords,
    calendarDays,
    today,
  } = params;

  // ---- Determine enrollment window ----
  // The window runs from enter_date to whichever is earlier:
  // the student's leave_date or today's date.
  const effectiveEnd =
    leaveDate && leaveDate < today ? leaveDate : today;

  // ---- Count instructional days in the enrollment window ----
  // Only school days (is_school_day = true) within the window count.
  const enrolledDays = calendarDays.filter(
    (d) =>
      d.is_school_day && d.date >= enrollmentDate && d.date <= effectiveEnd
  );
  const daysEnrolled = enrolledDays.length;

  // Build a set of enrolled instructional dates for O(1) lookup
  const enrolledDateSet = new Set(enrolledDays.map((d) => d.date));

  // ---- Filter attendance records to enrollment window ----
  // Only records on instructional days within the window are relevant.
  const relevantRecords = attendanceRecords.filter((r) =>
    enrolledDateSet.has(r.date)
  );

  // ---- Classify each record ----
  let daysPresent = 0;
  let daysAbsent = 0;
  let daysAbsentExcused = 0;
  let daysAbsentUnexcused = 0;
  let daysTardy = 0;
  let daysSuspended = 0;
  let daysSuspendedInSchool = 0;
  let daysISComplete = 0;
  let daysISIncomplete = 0;
  let adaEligibleDays = 0;
  let truancyCount = 0;

  for (const record of relevantRecords) {
    const ct = record.canonical_type;

    // Primary classification: present vs absent
    if (PRESENT_TYPES.has(ct)) {
      daysPresent++;
    } else if (ABSENT_TYPES.has(ct)) {
      daysAbsent++;
    }
    // 'not_enrolled' records are silently skipped

    // Excused / unexcused breakdown (within the absent bucket)
    if (ct === "absent_excused") daysAbsentExcused++;
    if (ct === "absent_unexcused") daysAbsentUnexcused++;

    // Tardy count (these students ARE present, just late)
    if (TARDY_TYPES.has(ct)) daysTardy++;

    // Suspension breakdown
    if (SUSPENSION_TYPES.has(ct)) daysSuspended++;
    if (ct === "suspension_in_school") daysSuspendedInSchool++;

    // Independent study breakdown
    if (ct === "independent_study_complete") daysISComplete++;
    if (ct === "independent_study_incomplete") daysISIncomplete++;

    // Truancy events (flagged at ingestion based on EC §48260 criteria)
    if (record.counts_as_truancy) truancyCount++;

    // ADA: student was present AND day is ADA-eligible
    if (PRESENT_TYPES.has(ct) && record.counts_for_ada) {
      adaEligibleDays++;
    }
  }

  // ---- Compute rates ----
  // Guard against division by zero. If no enrolled days, all rates are 0.
  // Rates are rounded to 1 decimal place (e.g., 93.5%).
  const attendanceRate =
    daysEnrolled > 0
      ? Math.round((daysPresent / daysEnrolled) * 1000) / 10
      : 0;

  const absenceRate =
    daysEnrolled > 0
      ? Math.round((daysAbsent / daysEnrolled) * 1000) / 10
      : 0;

  const adaRate =
    daysEnrolled > 0
      ? Math.round((adaEligibleDays / daysEnrolled) * 1000) / 10
      : 0;

  // ---- Chronic absence classification ----
  // Per EC §60901(c)(1): >= 10% of enrolled days absent = chronic
  const isChronicAbsent = absenceRate >= 10.0;

  // ---- Attendance Works band ----
  const attendanceBand = classifyBand(absenceRate);

  return {
    student_id: studentId,
    school_id: schoolId,
    academic_year: academicYear,
    snapshot_date: today,

    days_enrolled: daysEnrolled,
    days_present: daysPresent,
    days_absent: daysAbsent,
    days_absent_excused: daysAbsentExcused,
    days_absent_unexcused: daysAbsentUnexcused,
    days_tardy: daysTardy,
    days_truant: truancyCount,
    days_suspended: daysSuspended,
    days_suspended_in_school: daysSuspendedInSchool,
    days_independent_study_complete: daysISComplete,
    days_independent_study_incomplete: daysISIncomplete,

    attendance_rate: attendanceRate,
    absence_rate: absenceRate,
    ada_rate: adaRate,

    is_chronic_absent: isChronicAbsent,
    attendance_band: attendanceBand,

    ada_eligible_days: adaEligibleDays,
    truancy_count: truancyCount,
  };
}
