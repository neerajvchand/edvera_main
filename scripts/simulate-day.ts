/**
 * Edvera Day Simulator
 *
 * Advances the school year by inserting new attendance_daily records for
 * all active students, then runs the full engine pipeline (snapshots →
 * risk signals → compliance). Simulates what happens when real SIS data
 * arrives — attendance records appear, engines recompute, dashboard
 * numbers change.
 *
 * Usage:
 *   npx tsx scripts/simulate-day.ts                    # adds next school day
 *   npx tsx scripts/simulate-day.ts --days 5           # adds 5 consecutive days
 *   npx tsx scripts/simulate-day.ts --date 2026-02-15  # adds a specific date
 *   npx tsx scripts/simulate-day.ts --days 5 --outbreak # flu wave at one school
 *
 * Deterministic: uses a seeded PRNG based on the date string, so running
 * the same date twice produces the same results (idempotent — skips if
 * records already exist for that date).
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Import pure engine functions directly. tsx handles .ts imports natively.
import {
  computeSnapshot,
  type AttendanceRecord,
  type CalendarDay,
} from "../supabase/functions/_shared/snapshot-engine.ts";
import {
  computeRiskSignal,
  type SnapshotData,
  type AttendanceWindow,
  type ExistingSignal,
  type SignalLevel,
} from "../supabase/functions/_shared/risk-engine.ts";
import {
  evaluateCompliance,
  type ComplianceSnapshot,
  type ExistingCase,
  type InterventionRecord,
} from "../supabase/functions/_shared/compliance-engine.ts";
import {
  generateActions,
  type ComplianceCaseInput,
  type ExistingAction,
} from "../supabase/functions/_shared/action-generator.ts";

// ---------------------------------------------------------------------------
// ENV
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_URL in .env");
  process.exit(1);
}
if (!SUPABASE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// SEEDED PRNG (deterministic — seed derived from date string)
// ---------------------------------------------------------------------------
let _seed = 42;

function seedFromDate(dateStr: string): void {
  // Simple hash of the date string to produce a deterministic seed
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  _seed = Math.abs(hash) || 42;
}

function rand(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ---------------------------------------------------------------------------
// DATE HELPERS
// ---------------------------------------------------------------------------
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function getAcademicYear(date: Date): string {
  const year =
    date.getMonth() >= 6
      ? date.getFullYear()
      : date.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

// ---------------------------------------------------------------------------
// CLI ARGS
// ---------------------------------------------------------------------------
function parseArgs(): { days: number; date: string | null; outbreak: boolean } {
  const args = process.argv.slice(2);
  let days = 1;
  let date: string | null = null;
  let outbreak = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      if (isNaN(days) || days < 1) {
        console.error("--days must be a positive integer");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--date" && args[i + 1]) {
      date = args[i + 1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error("--date must be in YYYY-MM-DD format");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--outbreak") {
      outbreak = true;
    }
  }

  return { days, date, outbreak };
}

// ---------------------------------------------------------------------------
// PAGINATED FETCH (same pattern as engine wrappers)
// ---------------------------------------------------------------------------
async function fetchAllRows(
  buildQuery: (client: typeof supabase) => any,
  pageSize = 1000
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(supabase).range(
      from,
      from + pageSize - 1
    );
    if (error) throw new Error(`Fetch failed at offset ${from}: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

// ---------------------------------------------------------------------------
// BATCH INSERT
// ---------------------------------------------------------------------------
async function batchInsert(
  table: string,
  rows: Record<string, unknown>[],
  batchSize = 200
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      throw new Error(`Insert into ${table} batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// BATCH UPSERT
// ---------------------------------------------------------------------------
async function batchUpsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  batchSize = 50
): Promise<number> {
  let errorCount = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`  ${table} upsert batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
      errorCount += batch.length;
    }
  }
  return errorCount;
}

// ---------------------------------------------------------------------------
// CANONICAL TYPE SETS (for risk signal window building)
// ---------------------------------------------------------------------------
const PRESENT_TYPES = new Set([
  "present",
  "tardy",
  "tardy_excused",
  "tardy_unexcused",
  "independent_study_complete",
]);

const ABSENT_TYPES = new Set([
  "absent_unverified",
  "absent_excused",
  "absent_unexcused",
  "suspension_in_school",
  "suspension_out_of_school",
  "independent_study_incomplete",
]);

function buildRiskWindow(
  records: Array<{ date: string; canonical_type: string }>,
  calendarDays: Array<{ date: string; is_school_day: boolean }>,
  startDate: string,
  endDate: string
): AttendanceWindow {
  const schoolDaysInWindow = calendarDays.filter(
    (d) => d.is_school_day && d.date >= startDate && d.date <= endDate
  );
  const schoolDaySet = new Set(schoolDaysInWindow.map((d) => d.date));
  const windowRecords = records.filter((r) => schoolDaySet.has(r.date));

  let daysPresent = 0;
  let daysAbsent = 0;
  for (const record of windowRecords) {
    if (PRESENT_TYPES.has(record.canonical_type)) daysPresent++;
    if (ABSENT_TYPES.has(record.canonical_type)) daysAbsent++;
  }

  const sortedSchoolDays = [...schoolDaysInWindow].sort(
    (a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)
  );
  const recordMap = new Map<string, string>();
  for (const r of windowRecords) recordMap.set(r.date, r.canonical_type);

  let consecutiveAbsencesTail = 0;
  for (const day of sortedSchoolDays) {
    const ct = recordMap.get(day.date);
    if (ct && ABSENT_TYPES.has(ct)) consecutiveAbsencesTail++;
    else break;
  }

  return {
    days_enrolled: schoolDaysInWindow.length,
    days_present: daysPresent,
    days_absent: daysAbsent,
    consecutive_absences_tail: consecutiveAbsencesTail,
  };
}

// ============================================================================
// PHASE 1: SIMULATE ATTENDANCE FOR ONE DAY
// ============================================================================

interface SimDaySummary {
  date: string;
  dayNumber: number;
  totalDays: number;
  presentCount: number;
  absentCount: number;
  tardyCount: number;
  unexcusedCount: number;
  excusedCount: number;
  skipped: boolean;
}

async function simulateOneDay(
  targetDate: string,
  outbreak: boolean,
  schoolCalendarMap: Map<string, Array<{ date: string; is_school_day: boolean }>>,
  enrollments: any[],
  absenceCodes: any[],
  snapshots: Map<string, any>
): Promise<SimDaySummary> {
  // Seed PRNG from date string for deterministic results
  seedFromDate(targetDate);

  // Count total instructional days in the academic year up to this date
  let totalInstructionalDays = 0;
  let dayNumber = 0;
  // Use first school's calendar to count overall progress
  for (const [, calendar] of schoolCalendarMap) {
    for (const d of calendar) {
      if (d.is_school_day) {
        totalInstructionalDays++;
        if (d.date <= targetDate) dayNumber++;
      }
    }
    break; // only need one school for the count
  }

  // Check if records already exist for this date (idempotent)
  const { count: existingCount } = await supabase
    .from("attendance_daily")
    .select("*", { count: "exact", head: true })
    .eq("calendar_date", targetDate);

  if (existingCount && existingCount > 0) {
    return {
      date: targetDate,
      dayNumber,
      totalDays: totalInstructionalDays,
      presentCount: 0,
      absentCount: 0,
      tardyCount: 0,
      unexcusedCount: 0,
      excusedCount: 0,
      skipped: true,
    };
  }

  // Pick outbreak school if --outbreak
  let outbreakSchoolId: string | null = null;
  if (outbreak) {
    const schoolIds = [...new Set(enrollments.map((e) => e.school_id))];
    outbreakSchoolId = pick(schoolIds);
  }

  // Index absence codes by type for quick lookup
  const unexcusedCodes = absenceCodes.filter((c: any) => c.counts_as_truancy);
  const excusedCodes = absenceCodes.filter(
    (c: any) =>
      c.canonical_type === "absent_excused"
  );
  const tardyCodes = absenceCodes.filter(
    (c: any) =>
      c.canonical_type === "tardy_unexcused" ||
      c.canonical_type === "tardy_excused"
  );

  // Fallbacks if no codes found for a category
  const defaultUnexcused = unexcusedCodes[0] || absenceCodes.find((c: any) => c.canonical_type === "absent_unexcused");
  const defaultExcused = excusedCodes[0] || absenceCodes.find((c: any) => c.canonical_type === "absent_excused");
  const defaultTardy = tardyCodes[0] || absenceCodes.find((c: any) => c.canonical_type === "tardy_unexcused");

  // Generate attendance for each active student
  const rows: Record<string, unknown>[] = [];
  let presentCount = 0;
  let absentCount = 0;
  let tardyCount = 0;
  let unexcusedCount = 0;
  let excusedCount = 0;

  for (const enrollment of enrollments) {
    // Verify this date is a school day for this student's school
    const schoolCalendar = schoolCalendarMap.get(enrollment.school_id);
    if (!schoolCalendar) continue;
    const calDay = schoolCalendar.find((d) => d.date === targetDate);
    if (!calDay || !calDay.is_school_day) continue;

    // Get student's existing absence rate from snapshot
    const snap = snapshots.get(enrollment.student_id);
    let baseAbsenceProb = 0.07; // default ~7% for new students
    if (snap && snap.days_enrolled > 0) {
      baseAbsenceProb = snap.days_absent / snap.days_enrolled;
    }

    // Outbreak boost: +15% absence probability at affected school
    if (outbreakSchoolId && enrollment.school_id === outbreakSchoolId) {
      baseAbsenceProb = Math.min(0.95, baseAbsenceProb + 0.15);
    }

    // Pattern break: 2% chance of inverting the pattern
    const patternBreak = rand() < 0.02;
    let effectiveAbsenceProb = patternBreak
      ? 1.0 - baseAbsenceProb // normally-present students are absent; chronic students show up
      : baseAbsenceProb;

    // Determine attendance
    const roll = rand();

    if (roll < effectiveAbsenceProb) {
      // ABSENT — determine type
      const typeRoll = rand();
      let code: any;

      if (typeRoll < 0.60 && defaultUnexcused) {
        // 60% unexcused
        code = pick(unexcusedCodes.length > 0 ? unexcusedCodes : [defaultUnexcused]);
        unexcusedCount++;
      } else if (typeRoll < 0.90 && defaultExcused) {
        // 30% excused
        code = pick(excusedCodes.length > 0 ? excusedCodes : [defaultExcused]);
        excusedCount++;
      } else if (defaultTardy) {
        // 10% tardy (still technically absent in the tardy sense)
        code = pick(tardyCodes.length > 0 ? tardyCodes : [defaultTardy]);
        tardyCount++;
      } else {
        code = defaultUnexcused;
        unexcusedCount++;
      }

      // Tardy types count as present in the summary
      if (code && PRESENT_TYPES.has(code.canonical_type)) {
        presentCount++;
      } else {
        absentCount++;
      }

      rows.push({
        student_id: enrollment.student_id,
        school_id: enrollment.school_id,
        calendar_date: targetDate,
        sis_absence_code: code?.sis_code ?? null,
        absence_code_map_id: code?.id ?? null,
        canonical_type: code?.canonical_type ?? "absent_unexcused",
        counts_for_ada: code?.counts_for_ada ?? false,
        counts_as_truancy: code?.counts_as_truancy ?? false,
        has_period_detail: false,
        last_synced_at: new Date().toISOString(),
      });
    } else {
      // PRESENT
      presentCount++;
      rows.push({
        student_id: enrollment.student_id,
        school_id: enrollment.school_id,
        calendar_date: targetDate,
        sis_absence_code: null,
        absence_code_map_id: null,
        canonical_type: "present",
        counts_for_ada: true,
        counts_as_truancy: false,
        has_period_detail: false,
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  // Insert all attendance records
  if (rows.length > 0) {
    await batchInsert("attendance_daily", rows);
  }

  return {
    date: targetDate,
    dayNumber,
    totalDays: totalInstructionalDays,
    presentCount,
    absentCount,
    tardyCount,
    unexcusedCount,
    excusedCount,
    skipped: false,
  };
}

// ============================================================================
// PHASE 2: RUN ENGINE PIPELINE
// ============================================================================

interface EngineSummary {
  snapshots: { processed: number; chronic_count: number; error_count: number };
  riskSignals: {
    processed: number;
    elevated: number;
    softening: number;
    stable: number;
    error_count: number;
  };
  compliance: {
    processed: number;
    new_cases: number;
    escalations: number;
    error_count: number;
  };
  actions: {
    new_actions: number;
    error_count: number;
  };
}

async function runEnginePipeline(
  academicYear: string,
  today: string
): Promise<EngineSummary> {
  // ---- Phase 1: Compute Snapshots ----
  const snapshotResult = await runSnapshotEngine(academicYear, today);

  // ---- Phase 2: Compute Risk Signals ----
  const riskResult = await runRiskSignalEngine(academicYear, today);

  // ---- Phase 3: Compute Compliance ----
  const complianceResult = await runComplianceEngine(academicYear, today);

  // ---- Phase 4: Generate Actions ----
  const actionsResult = await runActionEngine(today);

  return {
    snapshots: snapshotResult,
    riskSignals: riskResult,
    compliance: complianceResult,
    actions: actionsResult,
  };
}

async function runSnapshotEngine(
  academicYear: string,
  today: string
): Promise<{ processed: number; chronic_count: number; error_count: number }> {
  const [enrollments, attendanceData, calendarData] = await Promise.all([
    fetchAllRows((client) =>
      client
        .from("enrollments")
        .select("student_id, school_id, academic_year, enter_date, leave_date")
        .eq("academic_year", academicYear)
        .is("leave_date", null)
    ),
    fetchAllRows((client) =>
      client
        .from("attendance_daily")
        .select("student_id, calendar_date, canonical_type, counts_for_ada, counts_as_truancy")
    ),
    fetchAllRows((client) =>
      client
        .from("school_calendars")
        .select("school_id, calendar_date, is_school_day")
        .eq("academic_year", academicYear)
    ),
  ]);

  // Index
  const attendanceByStudent = new Map<string, AttendanceRecord[]>();
  for (const row of attendanceData) {
    let records = attendanceByStudent.get(row.student_id);
    if (!records) { records = []; attendanceByStudent.set(row.student_id, records); }
    records.push({
      date: row.calendar_date,
      canonical_type: row.canonical_type,
      counts_for_ada: row.counts_for_ada,
      counts_as_truancy: row.counts_as_truancy,
    });
  }

  const calendarBySchool = new Map<string, CalendarDay[]>();
  for (const row of calendarData) {
    let days = calendarBySchool.get(row.school_id);
    if (!days) { days = []; calendarBySchool.set(row.school_id, days); }
    days.push({ date: row.calendar_date, is_school_day: row.is_school_day });
  }

  // Compute
  let processed = 0;
  let chronicCount = 0;
  let errorCount = 0;
  const dbRows: Record<string, unknown>[] = [];

  for (const enrollment of enrollments) {
    try {
      const studentRecords = attendanceByStudent.get(enrollment.student_id) ?? [];
      const schoolCalendar = calendarBySchool.get(enrollment.school_id) ?? [];

      const snapshot = computeSnapshot({
        studentId: enrollment.student_id,
        schoolId: enrollment.school_id,
        academicYear: enrollment.academic_year,
        enrollmentDate: enrollment.enter_date,
        leaveDate: enrollment.leave_date,
        attendanceRecords: studentRecords,
        calendarDays: schoolCalendar,
        today,
      });

      dbRows.push({
        student_id: snapshot.student_id,
        school_id: snapshot.school_id,
        academic_year: snapshot.academic_year,
        snapshot_date: snapshot.snapshot_date,
        days_enrolled: snapshot.days_enrolled,
        days_present: snapshot.days_present,
        days_absent: snapshot.days_absent,
        days_absent_excused: snapshot.days_absent_excused,
        days_absent_unexcused: snapshot.days_absent_unexcused,
        days_tardy: snapshot.days_tardy,
        days_truant: snapshot.days_truant,
        days_suspended: snapshot.days_suspended,
        days_suspended_in_school: snapshot.days_suspended_in_school,
        days_independent_study_complete: snapshot.days_independent_study_complete,
        days_independent_study_incomplete: snapshot.days_independent_study_incomplete,
        attendance_rate: snapshot.attendance_rate,
        ada_rate: snapshot.ada_rate,
        is_chronic_absent: snapshot.is_chronic_absent,
        computed_at: new Date().toISOString(),
      });

      if (snapshot.is_chronic_absent) chronicCount++;
      processed++;
    } catch (err) {
      errorCount++;
    }
  }

  // Write
  const writeErrors = await batchUpsert("attendance_snapshots", dbRows, "student_id,academic_year");
  errorCount += writeErrors;
  processed -= writeErrors;

  return { processed, chronic_count: chronicCount, error_count: errorCount };
}

async function runRiskSignalEngine(
  academicYear: string,
  today: string
): Promise<{
  processed: number;
  elevated: number;
  softening: number;
  stable: number;
  error_count: number;
}> {
  const now = new Date(today);
  const recent30Start = addDays(now, -30);
  const recentStartStr = toDateStr(recent30Start);
  const prior60Start = addDays(now, -60);
  const priorStartStr = toDateStr(prior60Start);
  const priorEnd = addDays(recent30Start, -1);
  const priorEndStr = toDateStr(priorEnd);

  const [snapshots, attendanceData, calendarData, existingSignals] =
    await Promise.all([
      fetchAllRows((client) =>
        client
          .from("attendance_snapshots")
          .select("student_id, school_id, academic_year, days_enrolled, days_present, days_absent, attendance_rate, is_chronic_absent")
          .eq("academic_year", academicYear)
      ),
      fetchAllRows((client) =>
        client
          .from("attendance_daily")
          .select("student_id, calendar_date, canonical_type")
          .gte("calendar_date", priorStartStr)
          .lte("calendar_date", today)
      ),
      fetchAllRows((client) =>
        client
          .from("school_calendars")
          .select("school_id, calendar_date, is_school_day")
          .gte("calendar_date", priorStartStr)
          .lte("calendar_date", today)
      ),
      fetchAllRows((client) =>
        client.from("risk_signals").select("student_id, signal_level")
      ),
    ]);

  // Index
  const attendanceByStudent = new Map<string, Array<{ date: string; canonical_type: string }>>();
  for (const row of attendanceData) {
    let records = attendanceByStudent.get(row.student_id);
    if (!records) { records = []; attendanceByStudent.set(row.student_id, records); }
    records.push({ date: row.calendar_date, canonical_type: row.canonical_type });
  }

  const calendarBySchool = new Map<string, Array<{ date: string; is_school_day: boolean }>>();
  for (const row of calendarData) {
    let days = calendarBySchool.get(row.school_id);
    if (!days) { days = []; calendarBySchool.set(row.school_id, days); }
    days.push({ date: row.calendar_date, is_school_day: row.is_school_day });
  }

  const existingByStudent = new Map<string, ExistingSignal>();
  for (const row of existingSignals) {
    existingByStudent.set(row.student_id, { signal_level: row.signal_level as SignalLevel });
  }

  // Compute
  let processed = 0;
  let elevatedCount = 0;
  let softeningCount = 0;
  let stableCount = 0;
  let errorCount = 0;
  const dbRows: Record<string, unknown>[] = [];

  for (const snap of snapshots) {
    try {
      const studentRecords = attendanceByStudent.get(snap.student_id) ?? [];
      const schoolCalendar = calendarBySchool.get(snap.school_id) ?? [];
      const existingSignal = existingByStudent.get(snap.student_id) ?? null;

      const recentWindow = buildRiskWindow(studentRecords, schoolCalendar, recentStartStr, today);
      const priorWindow = buildRiskWindow(studentRecords, schoolCalendar, priorStartStr, priorEndStr);

      const snapshotData: SnapshotData = {
        student_id: snap.student_id,
        school_id: snap.school_id,
        academic_year: snap.academic_year,
        days_enrolled: snap.days_enrolled,
        days_present: snap.days_present,
        days_absent: snap.days_absent,
        attendance_rate: parseFloat(snap.attendance_rate) || 0,
        is_chronic_absent: snap.is_chronic_absent,
      };

      const signal = computeRiskSignal({
        snapshot: snapshotData,
        recentWindow,
        priorWindow,
        existingSignal,
        today,
      });

      dbRows.push({
        student_id: signal.student_id,
        school_id: signal.school_id,
        signal_level: signal.signal_level,
        signal_title: signal.signal_title,
        signal_subtitle: signal.signal_subtitle,
        next_step: signal.next_step,
        attendance_rate: signal.attendance_rate,
        consecutive_absences: signal.consecutive_absences,
        total_days: signal.total_days,
        last_30_rate: signal.last_30_rate,
        previous_30_rate: signal.previous_30_rate,
        trend_delta: signal.trend_delta,
        predicted_year_end_rate: signal.predicted_year_end_rate,
        predicted_chronic_risk_pct: signal.predicted_chronic_risk_pct,
        computed_at: new Date().toISOString(),
      });

      switch (signal.signal_level) {
        case "elevated": elevatedCount++; break;
        case "softening": softeningCount++; break;
        case "stable": stableCount++; break;
      }
      processed++;
    } catch {
      errorCount++;
    }
  }

  // Write
  const writeErrors = await batchUpsert("risk_signals", dbRows, "student_id");
  errorCount += writeErrors;
  processed -= writeErrors;

  return { processed, elevated: elevatedCount, softening: softeningCount, stable: stableCount, error_count: errorCount };
}

async function runComplianceEngine(
  academicYear: string,
  today: string
): Promise<{
  processed: number;
  new_cases: number;
  escalations: number;
  error_count: number;
}> {
  const [snapshots, casesData, interventionsData] = await Promise.all([
    fetchAllRows((client) =>
      client
        .from("attendance_snapshots")
        .select(
          "student_id, school_id, academic_year, " +
            "days_enrolled, days_present, days_absent, " +
            "days_absent_unexcused, days_truant, " +
            "attendance_rate, is_chronic_absent"
        )
        .eq("academic_year", academicYear)
    ),
    fetchAllRows((client) =>
      client
        .from("compliance_cases")
        .select(
          "id, student_id, school_id, academic_year, current_tier, " +
            "tier_1_triggered_at, tier_2_triggered_at, tier_3_triggered_at, " +
            "created_at"
        )
        .eq("academic_year", academicYear)
        .eq("is_resolved", false)
    ),
    fetchAllRows((client) =>
      client
        .from("intervention_log")
        .select("id, compliance_case_id, intervention_type, intervention_date")
        .not("compliance_case_id", "is", null)
    ),
  ]);

  // Index
  const interventionsByCase = new Map<string, InterventionRecord[]>();
  for (const row of interventionsData) {
    if (!row.compliance_case_id) continue;
    let records = interventionsByCase.get(row.compliance_case_id);
    if (!records) { records = []; interventionsByCase.set(row.compliance_case_id, records); }
    records.push({ intervention_type: row.intervention_type, conducted_at: row.intervention_date });
  }

  const caseByStudent = new Map<string, ExistingCase>();
  for (const row of casesData) {
    caseByStudent.set(row.student_id, {
      id: row.id,
      current_tier: row.current_tier,
      opened_at: row.created_at,
      tier_1_triggered_at: row.tier_1_triggered_at,
      tier_2_triggered_at: row.tier_2_triggered_at,
      tier_3_triggered_at: row.tier_3_triggered_at,
      interventions: interventionsByCase.get(row.id) ?? [],
    });
  }

  // Compute
  let processed = 0;
  let newCases = 0;
  let escalations = 0;
  let errorCount = 0;

  const inserts: Record<string, unknown>[] = [];
  const escalateOps: Array<{ caseId: string; data: Record<string, unknown> }> = [];
  const updateOps: Array<{ caseId: string; data: Record<string, unknown> }> = [];

  for (const snap of snapshots) {
    try {
      const existingCase = caseByStudent.get(snap.student_id) ?? null;
      const absenceRate =
        snap.days_enrolled > 0
          ? Math.round((snap.days_absent / snap.days_enrolled) * 1000) / 10
          : 0;

      const complianceSnapshot: ComplianceSnapshot = {
        days_enrolled: snap.days_enrolled,
        days_absent: snap.days_absent,
        days_absent_unexcused: snap.days_absent_unexcused ?? 0,
        absence_rate: absenceRate,
        is_chronic_absent: snap.is_chronic_absent,
        truancy_count: snap.days_truant ?? 0,
        total_absences: snap.days_absent,
      };

      const result = evaluateCompliance({
        studentId: snap.student_id,
        schoolId: snap.school_id,
        academicYear,
        snapshot: complianceSnapshot,
        existingCase,
        today,
      });

      if (result.action === "create_case" && result.case_data) {
        inserts.push({
          student_id: result.case_data.student_id,
          school_id: result.case_data.school_id,
          academic_year: result.case_data.academic_year,
          current_tier: result.case_data.current_tier,
          unexcused_absence_count: result.case_data.unexcused_count,
          truancy_count: result.case_data.truancy_count,
          total_absence_count: result.case_data.total_absences,
          tier_1_triggered_at: result.case_data.tier_1_triggered_at ?? null,
        });
        newCases++;
      } else if (result.action === "escalate_case" && result.case_data && result.existing_case_id) {
        const updateData: Record<string, unknown> = {
          current_tier: result.case_data.current_tier,
          unexcused_absence_count: result.case_data.unexcused_count,
          truancy_count: result.case_data.truancy_count,
          total_absence_count: result.case_data.total_absences,
        };
        if (result.case_data.tier_2_triggered_at) updateData.tier_2_triggered_at = result.case_data.tier_2_triggered_at;
        if (result.case_data.tier_3_triggered_at) updateData.tier_3_triggered_at = result.case_data.tier_3_triggered_at;
        escalateOps.push({ caseId: result.existing_case_id, data: updateData });
        escalations++;
      } else if (result.action === "update_case" && result.case_data && result.existing_case_id) {
        updateOps.push({
          caseId: result.existing_case_id,
          data: {
            unexcused_absence_count: result.case_data.unexcused_count,
            truancy_count: result.case_data.truancy_count,
            total_absence_count: result.case_data.total_absences,
          },
        });
      }

      processed++;
    } catch {
      errorCount++;
    }
  }

  // Write
  if (inserts.length > 0) {
    const writeErrors = await batchUpsert("compliance_cases", inserts, "student_id,academic_year");
    if (writeErrors > 0) { errorCount += writeErrors; newCases -= writeErrors; }
  }

  for (const op of escalateOps) {
    const { error } = await supabase.from("compliance_cases").update(op.data).eq("id", op.caseId);
    if (error) { errorCount++; escalations--; }
  }

  for (const op of updateOps) {
    const { error } = await supabase.from("compliance_cases").update(op.data).eq("id", op.caseId);
    if (error) errorCount++;
  }

  return { processed, new_cases: newCases, escalations, error_count: errorCount };
}

async function runActionEngine(
  today: string
): Promise<{ new_actions: number; error_count: number }> {
  // Fetch open compliance cases + existing actions
  const [casesData, existingActionsData] = await Promise.all([
    fetchAllRows((client) =>
      client
        .from("compliance_cases")
        .select(
          "id, student_id, school_id, current_tier, created_at, " +
            "tier_1_triggered_at, tier_2_triggered_at, tier_3_triggered_at, is_resolved"
        )
        .eq("is_resolved", false)
    ),
    fetchAllRows((client) =>
      client
        .from("actions")
        .select("compliance_case_id, action_type, status")
    ),
  ]);

  const cases: ComplianceCaseInput[] = casesData.map((c: any) => ({
    id: c.id,
    student_id: c.student_id,
    school_id: c.school_id,
    current_tier: c.current_tier,
    created_at: c.created_at,
    tier_1_triggered_at: c.tier_1_triggered_at,
    tier_2_triggered_at: c.tier_2_triggered_at,
    tier_3_triggered_at: c.tier_3_triggered_at,
    is_resolved: c.is_resolved,
  }));

  const existingActions: ExistingAction[] = existingActionsData.map((a: any) => ({
    compliance_case_id: a.compliance_case_id,
    action_type: a.action_type,
    status: a.status,
  }));

  const newActions = generateActions({
    complianceCases: cases,
    existingActions,
    today,
  });

  let errorCount = 0;
  if (newActions.length > 0) {
    const BATCH_SIZE = 200;
    for (let i = 0; i < newActions.length; i += BATCH_SIZE) {
      const batch = newActions.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("actions").insert(batch);
      if (error) {
        errorCount += batch.length;
      }
    }
  }

  return { new_actions: newActions.length - errorCount, error_count: errorCount };
}

// ============================================================================
// FIND NEXT SCHOOL DAY
// ============================================================================

async function findNextSchoolDay(
  academicYear: string,
  startDate?: string
): Promise<string> {
  if (startDate) return startDate;

  // Find MAX(calendar_date) from attendance_daily
  const { data: maxRow } = await supabase
    .from("attendance_daily")
    .select("calendar_date")
    .order("calendar_date", { ascending: false })
    .limit(1);

  let lastDate: Date;
  if (maxRow && maxRow.length > 0) {
    lastDate = new Date(maxRow[0].calendar_date);
  } else {
    // No attendance data — start from beginning of academic year
    lastDate = new Date("2025-08-10"); // day before year start
  }

  // Fetch school calendar for the academic year (use first school)
  const { data: calendarDays } = await supabase
    .from("school_calendars")
    .select("calendar_date, is_school_day")
    .eq("academic_year", academicYear)
    .gt("calendar_date", toDateStr(lastDate))
    .eq("is_school_day", true)
    .order("calendar_date", { ascending: true })
    .limit(1);

  if (calendarDays && calendarDays.length > 0) {
    return calendarDays[0].calendar_date;
  }

  // Fallback: advance from last date, skipping weekends
  let next = addDays(lastDate, 1);
  while (isWeekend(next)) {
    next = addDays(next, 1);
  }
  return toDateStr(next);
}

// ============================================================================
// DISPLAY
// ============================================================================

function printDaySummary(
  sim: SimDaySummary,
  engine: EngineSummary,
  prevChronic: number
): void {
  const bar = "─".repeat(47);
  const chronicDelta = engine.snapshots.chronic_count - prevChronic;
  const deltaStr =
    chronicDelta > 0
      ? ` (+${chronicDelta})`
      : chronicDelta < 0
        ? ` (${chronicDelta})`
        : " (=)";

  console.log(`┌${bar}┐`);
  console.log(
    `│ ${`Simulated: ${sim.date} (Day ${sim.dayNumber} of ${sim.totalDays})`.padEnd(46)}│`
  );
  console.log(`├${bar}┤`);
  console.log(
    `│ ${`Present: ${sim.presentCount}  Absent: ${sim.absentCount}  Tardy: ${sim.tardyCount}`.padEnd(46)}│`
  );
  console.log(
    `│ ${`New unexcused: ${sim.unexcusedCount}  New excused: ${sim.excusedCount}`.padEnd(46)}│`
  );
  console.log(`├${bar}┤`);
  console.log(
    `│ ${`Snapshots recomputed: ${engine.snapshots.processed}`.padEnd(46)}│`
  );
  console.log(
    `│ ${`Chronic absent: ${prevChronic} → ${engine.snapshots.chronic_count}${deltaStr}`.padEnd(46)}│`
  );
  console.log(
    `│ ${`Risk signals: ${engine.riskSignals.elevated} elevated, ${engine.riskSignals.softening} softening`.padEnd(46)}│`
  );
  console.log(
    `│ ${`Compliance: ${engine.compliance.new_cases} new, ${engine.compliance.escalations} escalations`.padEnd(46)}│`
  );
  console.log(
    `│ ${`Actions generated: ${engine.actions.new_actions}`.padEnd(46)}│`
  );
  console.log(`└${bar}┘`);
}

function printSkippedDay(date: string): void {
  console.log(`  ⏭  ${date} — records already exist, skipping`);
}

function printGrandSummary(
  days: number,
  firstDate: string,
  lastDate: string,
  totalPresent: number,
  totalAbsent: number,
  startChronic: number,
  endChronic: number,
  totalNewCases: number,
  totalEscalations: number,
  elapsedMs: number
): void {
  const bar = "═".repeat(47);
  const chronicDelta = endChronic - startChronic;
  const deltaStr =
    chronicDelta > 0
      ? `+${chronicDelta}`
      : chronicDelta < 0
        ? `${chronicDelta}`
        : "=";

  console.log();
  console.log(`╔${bar}╗`);
  console.log(
    `║ ${`GRAND SUMMARY: ${days} day${days > 1 ? "s" : ""} simulated`.padEnd(46)}║`
  );
  console.log(`╠${bar}╣`);
  console.log(
    `║ ${`Period: ${firstDate} → ${lastDate}`.padEnd(46)}║`
  );
  console.log(
    `║ ${`Total present: ${totalPresent}  Total absent: ${totalAbsent}`.padEnd(46)}║`
  );
  console.log(
    `║ ${`Chronic absent: ${startChronic} → ${endChronic} (${deltaStr})`.padEnd(46)}║`
  );
  console.log(
    `║ ${`New compliance cases: ${totalNewCases}`.padEnd(46)}║`
  );
  console.log(
    `║ ${`Compliance escalations: ${totalEscalations}`.padEnd(46)}║`
  );
  console.log(
    `║ ${`Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`.padEnd(46)}║`
  );
  console.log(`╚${bar}╝`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const startTime = Date.now();
  const { days, date, outbreak } = parseArgs();
  const now = new Date();
  const academicYear = getAcademicYear(now);

  console.log(`\n🎓 Edvera Day Simulator`);
  console.log(`   Academic year: ${academicYear}`);
  console.log(`   Days to simulate: ${days}`);
  if (outbreak) console.log(`   🦠 Outbreak mode: ON (one random school)`);
  console.log();

  // ---- Pre-load shared data ----
  console.log("Loading shared data...");

  const [enrollments, absenceCodes, calendarRows] = await Promise.all([
    fetchAllRows((client) =>
      client
        .from("enrollments")
        .select("student_id, school_id, academic_year, enter_date")
        .eq("academic_year", academicYear)
        .is("leave_date", null)
    ),
    fetchAllRows((client) =>
      client
        .from("absence_code_maps")
        .select("id, sis_code, canonical_type, counts_for_ada, counts_as_truancy")
    ),
    fetchAllRows((client) =>
      client
        .from("school_calendars")
        .select("school_id, calendar_date, is_school_day")
        .eq("academic_year", academicYear)
    ),
  ]);

  // Build school calendar map
  const schoolCalendarMap = new Map<string, Array<{ date: string; is_school_day: boolean }>>();
  for (const row of calendarRows) {
    let days = schoolCalendarMap.get(row.school_id);
    if (!days) { days = []; schoolCalendarMap.set(row.school_id, days); }
    days.push({ date: row.calendar_date, is_school_day: row.is_school_day });
  }

  console.log(`  ${enrollments.length} active enrollments, ${absenceCodes.length} absence codes`);
  console.log();

  // ---- Get initial chronic count for delta tracking ----
  const { count: initialChronicCount } = await supabase
    .from("attendance_snapshots")
    .select("*", { count: "exact", head: true })
    .eq("academic_year", academicYear)
    .eq("is_chronic_absent", true);
  let prevChronic = initialChronicCount ?? 0;
  const startChronic = prevChronic;

  // ---- Day loop ----
  let simulatedDays = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalNewCases = 0;
  let totalEscalations = 0;
  let firstDate = "";
  let lastDate = "";
  let currentDate = date ?? null;

  for (let d = 0; d < days; d++) {
    // Find next school day
    const targetDate = currentDate ?? await findNextSchoolDay(academicYear);

    if (d === 0) firstDate = targetDate;
    lastDate = targetDate;

    // Load current snapshots for absence-probability calculation
    const snapshotRows = await fetchAllRows((client) =>
      client
        .from("attendance_snapshots")
        .select("student_id, days_enrolled, days_absent")
        .eq("academic_year", academicYear)
    );
    const snapshots = new Map<string, any>();
    for (const s of snapshotRows) {
      snapshots.set(s.student_id, s);
    }

    // Simulate the day
    const sim = await simulateOneDay(
      targetDate,
      outbreak,
      schoolCalendarMap,
      enrollments,
      absenceCodes,
      snapshots
    );

    if (sim.skipped) {
      printSkippedDay(targetDate);
      // Advance to next school day for subsequent iterations
      currentDate = await findNextSchoolDay(academicYear, undefined);
      // Need a day after the skipped one
      const nextCandidates = calendarRows
        .filter(
          (r: any) => r.is_school_day && r.calendar_date > targetDate
        )
        .sort((a: any, b: any) => a.calendar_date.localeCompare(b.calendar_date));
      currentDate = nextCandidates.length > 0 ? nextCandidates[0].calendar_date : null;
      continue;
    }

    // Run engine pipeline
    process.stdout.write(`  Running engines for ${targetDate}...`);
    const engine = await runEnginePipeline(academicYear, targetDate);
    process.stdout.write(" done\n");

    // Display
    printDaySummary(sim, engine, prevChronic);
    prevChronic = engine.snapshots.chronic_count;

    // Accumulate
    simulatedDays++;
    totalPresent += sim.presentCount;
    totalAbsent += sim.absentCount;
    totalNewCases += engine.compliance.new_cases;
    totalEscalations += engine.compliance.escalations;

    // Find next school day for subsequent iteration
    const nextCandidates = calendarRows
      .filter(
        (r: any) => r.is_school_day && r.calendar_date > targetDate
      )
      .sort((a: any, b: any) => a.calendar_date.localeCompare(b.calendar_date));
    currentDate = nextCandidates.length > 0 ? nextCandidates[0].calendar_date : null;

    if (!currentDate && d < days - 1) {
      console.log("\n⚠️  No more school days in the calendar. Stopping.");
      break;
    }
  }

  // Grand summary (only if more than 1 day)
  if (simulatedDays > 1) {
    printGrandSummary(
      simulatedDays,
      firstDate,
      lastDate,
      totalPresent,
      totalAbsent,
      startChronic,
      prevChronic,
      totalNewCases,
      totalEscalations,
      Date.now() - startTime
    );
  } else if (simulatedDays === 1) {
    console.log(`\n✅ Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } else {
    console.log("\n⚠️  No days were simulated (all dates already had records).");
  }
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
