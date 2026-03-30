/**
 * Supabase Edge Function: run-all-engines
 *
 * Orchestrator that runs all five computation engines in sequence:
 *   1. compute-snapshots  — recalculates attendance snapshots
 *   2. compute-risk-signals — classifies students as stable/softening/elevated
 *   3. compute-compliance  — evaluates truancy/chronic thresholds, creates/escalates cases
 *   4. generate-actions    — creates actionable tasks from compliance cases
 *   5. compute-funding     — projects ADA revenue loss from chronic absence
 *
 * Calls each engine's core logic directly (imports the pure functions,
 * shares the same Supabase client) rather than making HTTP calls.
 * This avoids network overhead and auth complexity.
 *
 * If one engine fails, the error is logged and the orchestrator continues
 * to the next engine. Risk signals and compliance read from snapshots
 * independently, so they can still run even if the other fails.
 *
 * Usage (cron / server — scoped to one district):
 *   curl -i --location --request POST \
 *     'http://localhost:54321/functions/v1/run-all-engines' \
 *     --header 'X-Admin-API-Key: YOUR_ADMIN_API_KEY' \
 *     --header 'Content-Type: application/json' \
 *     --data '{"district_id":"<uuid>"}'
 *
 * Usage (browser — district admin JWT + Supabase session):
 *   supabase.functions.invoke('run-all-engines', { method: 'POST', body: {} })
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ------------------------------------------------------------------ */
/* CORS headers                                                        */
/* ------------------------------------------------------------------ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ------------------------------------------------------------------ */
/* Auth helpers                                                        */
/* ------------------------------------------------------------------ */

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Constant-time comparison via SHA-256 digests (avoids length leaks on raw compare).
 */
async function timingSafeStringEqual(
  expected: string,
  received: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const digest = (s: string) => crypto.subtle.digest("SHA-256", enc.encode(s));
  const [bufA, bufB] = await Promise.all([digest(expected), digest(received)]);
  return crypto.subtle.timingSafeEqual(
    new Uint8Array(bufA),
    new Uint8Array(bufB),
  );
}

type AuthOk = { ok: true; districtId: string };
type AuthFail = { ok: false; response: Response };

async function authorizeRunAllEngines(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
  body: Record<string, unknown>,
): Promise<AuthOk | AuthFail> {
  const adminApiKey = Deno.env.get("ADMIN_API_KEY");
  const providedAdminKey = req.headers.get("X-Admin-API-Key");

  if (providedAdminKey != null && providedAdminKey !== "") {
    if (!adminApiKey || adminApiKey.length === 0) {
      return { ok: false, response: jsonError(401, "Unauthorized") };
    }
    const match = await timingSafeStringEqual(adminApiKey, providedAdminKey);
    if (!match) {
      return { ok: false, response: jsonError(401, "Unauthorized") };
    }
    const districtId = body["district_id"];
    if (
      districtId == null ||
      typeof districtId !== "string" ||
      districtId.trim() === ""
    ) {
      return {
        ok: false,
        response: jsonError(400, "district_id is required in request body"),
      };
    }
    return { ok: true, districtId: districtId.trim() };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData.user) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }

  const { data: rows, error: memError } = await userClient
    .from("staff_memberships")
    .select("school_id, schools!inner(district_id)")
    .eq("role", "district_admin")
    .eq("is_active", true);

  if (memError) {
    console.error("run-all-engines: district admin membership query error", memError);
    return { ok: false, response: jsonError(403, "Forbidden") };
  }

  if (!rows || rows.length === 0) {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }

  const districtIds = new Set<string>();
  for (const row of rows as Array<{ schools: unknown }>) {
    const s = row.schools;
    if (Array.isArray(s)) {
      for (const x of s) {
        const d = (x as { district_id?: string })?.district_id;
        if (d) districtIds.add(d);
      }
    } else if (s && typeof s === "object" && "district_id" in s) {
      const d = (s as { district_id: string }).district_id;
      if (d) districtIds.add(d);
    }
  }

  if (districtIds.size === 0) {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }

  if (districtIds.size > 1) {
    return {
      ok: false,
      response: jsonError(
        403,
        "Forbidden: district admin must belong to a single district for this action",
      ),
    };
  }

  return { ok: true, districtId: [...districtIds][0] };
}

// Pure engine imports
import {
  computeSnapshot,
  type AttendanceRecord,
  type CalendarDay,
} from "../_shared/snapshot-engine.ts";
import {
  computeRiskSignal,
  type SnapshotData,
  type AttendanceWindow,
  type ExistingSignal,
  type SignalLevel,
} from "../_shared/risk-engine.ts";
import {
  evaluateCompliance,
  type ComplianceSnapshot,
  type ExistingCase,
  type InterventionRecord,
} from "../_shared/compliance-engine.ts";
import {
  generateActions,
  generateAdvisories,
  type ComplianceCaseInput,
  type ExistingAction,
  type CaseHealthContext,
} from "../_shared/action-generator.ts";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetches all rows from a query, paginating in chunks of `pageSize`
 * to avoid PostgREST's default 1000-row limit.
 */
async function fetchAllRows(
  supabase: ReturnType<typeof createClient>,
  buildQuery: (client: ReturnType<typeof createClient>) => any,
  pageSize = 1000
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(supabase).range(
      from,
      from + pageSize - 1
    );
    if (error) {
      throw new Error(`Fetch failed at offset ${from}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

const IN_CHUNK_SIZE = 120;

async function getSchoolIdsForDistrict(
  supabase: ReturnType<typeof createClient>,
  districtId: string,
): Promise<string[]> {
  const rows = await fetchAllRows(supabase, (client) =>
    client.from("schools").select("id").eq("district_id", districtId)
  );
  return rows.map((r: { id: string }) => r.id);
}

async function fetchAttendanceDailyForStudents(
  supabase: ReturnType<typeof createClient>,
  studentIds: string[],
  selectFields: string,
  dateRange?: { from: string; to: string },
): Promise<any[]> {
  if (studentIds.length === 0) return [];
  const out: any[] = [];
  for (let i = 0; i < studentIds.length; i += IN_CHUNK_SIZE) {
    const chunk = studentIds.slice(i, i + IN_CHUNK_SIZE);
    const rows = await fetchAllRows(supabase, (client) => {
      let q = client.from("attendance_daily").select(selectFields).in(
        "student_id",
        chunk,
      );
      if (dateRange) {
        q = q
          .gte("calendar_date", dateRange.from)
          .lte("calendar_date", dateRange.to);
      }
      return q;
    });
    out.push(...rows);
  }
  return out;
}

async function fetchRowsInChunks<T>(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
  buildQuery: (
    client: ReturnType<typeof createClient>,
    chunk: string[],
  ) => any,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
    const rows = await fetchAllRows(supabase, (c) => buildQuery(c, chunk));
    out.push(...rows);
  }
  return out;
}

function getAcademicYear(date: Date): string {
  const year =
    date.getMonth() >= 6
      ? date.getFullYear()
      : date.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Batch upsert helper — writes rows in chunks of BATCH_SIZE.
 * Returns count of rows that failed to write.
 */
async function batchUpsert(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  label: string,
  batchSize = 50
): Promise<number> {
  let errorCount = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict });

    if (error) {
      const batchNum = Math.floor(i / batchSize) + 1;
      console.error(`${label}: upsert batch ${batchNum} failed: ${error.message}`);
      errorCount += batch.length;
    }
  }
  return errorCount;
}

/* ------------------------------------------------------------------ */
/* Canonical type sets (shared by risk signals)                        */
/* ------------------------------------------------------------------ */

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
  const daysEnrolled = schoolDaysInWindow.length;
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
  for (const r of windowRecords) {
    recordMap.set(r.date, r.canonical_type);
  }

  let consecutiveAbsencesTail = 0;
  for (const day of sortedSchoolDays) {
    const ct = recordMap.get(day.date);
    if (ct && ABSENT_TYPES.has(ct)) {
      consecutiveAbsencesTail++;
    } else {
      break;
    }
  }

  return {
    days_enrolled: daysEnrolled,
    days_present: daysPresent,
    days_absent: daysAbsent,
    consecutive_absences_tail: consecutiveAbsencesTail,
  };
}

/* ------------------------------------------------------------------ */
/* Phase 1: Compute Snapshots                                          */
/* ------------------------------------------------------------------ */

interface SnapshotPhaseResult {
  processed: number;
  chronic_count: number;
  error_count: number;
  elapsed_seconds: number;
}

async function runSnapshots(
  supabase: ReturnType<typeof createClient>,
  academicYear: string,
  today: string,
  districtId: string,
): Promise<SnapshotPhaseResult> {
  const phaseStart = Date.now();
  console.log(`[snapshots] starting for ${academicYear} district=${districtId}`);

  const schoolIds = await getSchoolIdsForDistrict(supabase, districtId);
  if (schoolIds.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    return {
      processed: 0,
      chronic_count: 0,
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  const enrollments = await fetchAllRows(supabase, (client) =>
    client
      .from("enrollments")
      .select("student_id, school_id, academic_year, enter_date, leave_date")
      .eq("academic_year", academicYear)
      .is("leave_date", null)
      .in("school_id", schoolIds)
  );

  const studentIds = [...new Set(enrollments.map((e: { student_id: string }) => e.student_id))];

  const [attendanceData, calendarData] = await Promise.all([
    fetchAttendanceDailyForStudents(
      supabase,
      studentIds,
      "student_id, calendar_date, canonical_type, counts_for_ada, counts_as_truancy",
    ),
    fetchAllRows(supabase, (client) =>
      client
        .from("school_calendars")
        .select("school_id, calendar_date, is_school_day")
        .eq("academic_year", academicYear)
        .in("school_id", schoolIds)
    ),
  ]);

  console.log(
    `[snapshots] fetched ${enrollments.length} enrollments, ` +
      `${attendanceData.length} attendance, ${calendarData.length} calendar`
  );

  // ---- Index ----
  const attendanceByStudent = new Map<string, AttendanceRecord[]>();
  for (const row of attendanceData) {
    let records = attendanceByStudent.get(row.student_id);
    if (!records) {
      records = [];
      attendanceByStudent.set(row.student_id, records);
    }
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
    if (!days) {
      days = [];
      calendarBySchool.set(row.school_id, days);
    }
    days.push({
      date: row.calendar_date,
      is_school_day: row.is_school_day,
    });
  }

  // ---- Compute ----
  let processed = 0;
  let chronicCount = 0;
  let errorCount = 0;
  const dbRows: Record<string, unknown>[] = [];

  for (const enrollment of enrollments) {
    try {
      const studentRecords =
        attendanceByStudent.get(enrollment.student_id) ?? [];
      const schoolCalendar =
        calendarBySchool.get(enrollment.school_id) ?? [];

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
      console.error(
        `[snapshots] error processing student ${enrollment.student_id}:`,
        err
      );
      errorCount++;
    }
  }

  // ---- Write ----
  const writeErrors = await batchUpsert(
    supabase,
    "attendance_snapshots",
    dbRows,
    "student_id,academic_year",
    "[snapshots]"
  );
  errorCount += writeErrors;
  processed -= writeErrors;

  const elapsed = (Date.now() - phaseStart) / 1000;
  console.log(
    `[snapshots] done: ${processed} processed, ${chronicCount} chronic, ` +
      `${errorCount} errors in ${elapsed.toFixed(1)}s`
  );

  return {
    processed,
    chronic_count: chronicCount,
    error_count: errorCount,
    elapsed_seconds: parseFloat(elapsed.toFixed(1)),
  };
}

/* ------------------------------------------------------------------ */
/* Phase 2: Compute Risk Signals                                       */
/* ------------------------------------------------------------------ */

interface RiskSignalPhaseResult {
  processed: number;
  elevated: number;
  softening: number;
  stable: number;
  pending: number;
  error_count: number;
  elapsed_seconds: number;
}

async function runRiskSignals(
  supabase: ReturnType<typeof createClient>,
  academicYear: string,
  today: string,
  districtId: string,
): Promise<RiskSignalPhaseResult> {
  const phaseStart = Date.now();
  const now = new Date(today);
  console.log(`[risk-signals] starting for ${academicYear} district=${districtId}`);

  const schoolIds = await getSchoolIdsForDistrict(supabase, districtId);
  if (schoolIds.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    return {
      processed: 0,
      elevated: 0,
      softening: 0,
      stable: 0,
      pending: 0,
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  // ---- Date windows ----
  const recent30Start = new Date(now);
  recent30Start.setDate(recent30Start.getDate() - 30);
  const recentStartStr = toDateStr(recent30Start);

  const prior60Start = new Date(now);
  prior60Start.setDate(prior60Start.getDate() - 60);
  const priorStartStr = toDateStr(prior60Start);

  const priorEnd = new Date(recent30Start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorEndStr = toDateStr(priorEnd);

  const snapshots = await fetchAllRows(supabase, (client) =>
    client
      .from("attendance_snapshots")
      .select(
        "student_id, school_id, academic_year, days_enrolled, " +
          "days_present, days_absent, attendance_rate, is_chronic_absent"
      )
      .eq("academic_year", academicYear)
      .in("school_id", schoolIds)
  );

  const studentIds = [...new Set(snapshots.map((s: { student_id: string }) => s.student_id))];

  const [attendanceData, calendarData, existingSignals] = await Promise.all([
    fetchAttendanceDailyForStudents(
      supabase,
      studentIds,
      "student_id, calendar_date, canonical_type",
      { from: priorStartStr, to: today },
    ),
    fetchAllRows(supabase, (client) =>
      client
        .from("school_calendars")
        .select("school_id, calendar_date, is_school_day")
        .in("school_id", schoolIds)
        .gte("calendar_date", priorStartStr)
        .lte("calendar_date", today)
    ),
    fetchRowsInChunks<{ student_id: string; signal_level: string }>(
      supabase,
      studentIds,
      (client, chunk) =>
        client.from("risk_signals").select("student_id, signal_level").in(
          "student_id",
          chunk,
        ),
    ),
  ]);

  console.log(
    `[risk-signals] fetched ${snapshots.length} snapshots, ` +
      `${attendanceData.length} attendance (60d), ` +
      `${calendarData.length} calendar, ${existingSignals.length} existing`
  );

  // ---- Index ----
  const attendanceByStudent = new Map<
    string,
    Array<{ date: string; canonical_type: string }>
  >();
  for (const row of attendanceData) {
    let records = attendanceByStudent.get(row.student_id);
    if (!records) {
      records = [];
      attendanceByStudent.set(row.student_id, records);
    }
    records.push({
      date: row.calendar_date,
      canonical_type: row.canonical_type,
    });
  }

  const calendarBySchool = new Map<
    string,
    Array<{ date: string; is_school_day: boolean }>
  >();
  for (const row of calendarData) {
    let days = calendarBySchool.get(row.school_id);
    if (!days) {
      days = [];
      calendarBySchool.set(row.school_id, days);
    }
    days.push({
      date: row.calendar_date,
      is_school_day: row.is_school_day,
    });
  }

  const existingByStudent = new Map<string, ExistingSignal>();
  for (const row of existingSignals) {
    existingByStudent.set(row.student_id, {
      signal_level: row.signal_level as SignalLevel,
    });
  }

  // ---- Compute ----
  let processed = 0;
  let elevatedCount = 0;
  let softeningCount = 0;
  let stableCount = 0;
  let pendingCount = 0;
  let errorCount = 0;
  const dbRows: Record<string, unknown>[] = [];

  for (const snap of snapshots) {
    try {
      const studentRecords = attendanceByStudent.get(snap.student_id) ?? [];
      const schoolCalendar = calendarBySchool.get(snap.school_id) ?? [];
      const existingSignal = existingByStudent.get(snap.student_id) ?? null;

      const recentWindow = buildRiskWindow(
        studentRecords,
        schoolCalendar,
        recentStartStr,
        today
      );
      const priorWindow = buildRiskWindow(
        studentRecords,
        schoolCalendar,
        priorStartStr,
        priorEndStr
      );

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
        case "elevated":
          elevatedCount++;
          break;
        case "softening":
          softeningCount++;
          break;
        case "stable":
          stableCount++;
          break;
        case "pending":
          pendingCount++;
          break;
      }
      processed++;
    } catch (err) {
      console.error(
        `[risk-signals] error processing student ${snap.student_id}:`,
        err
      );
      errorCount++;
    }
  }

  // ---- Write ----
  const writeErrors = await batchUpsert(
    supabase,
    "risk_signals",
    dbRows,
    "student_id",
    "[risk-signals]"
  );
  errorCount += writeErrors;
  processed -= writeErrors;

  const elapsed = (Date.now() - phaseStart) / 1000;
  console.log(
    `[risk-signals] done: ${processed} processed ` +
      `(${elevatedCount} elevated, ${softeningCount} softening, ` +
      `${stableCount} stable, ${pendingCount} pending, ${errorCount} errors) ` +
      `in ${elapsed.toFixed(1)}s`
  );

  return {
    processed,
    elevated: elevatedCount,
    softening: softeningCount,
    stable: stableCount,
    pending: pendingCount,
    error_count: errorCount,
    elapsed_seconds: parseFloat(elapsed.toFixed(1)),
  };
}

/* ------------------------------------------------------------------ */
/* Phase 3: Compute Compliance                                         */
/* ------------------------------------------------------------------ */

interface CompliancePhaseResult {
  processed: number;
  new_cases: number;
  escalations: number;
  count_updates: number;
  tier_1: number;
  tier_2: number;
  tier_3: number;
  error_count: number;
  elapsed_seconds: number;
}

async function runCompliance(
  supabase: ReturnType<typeof createClient>,
  academicYear: string,
  today: string,
  districtId: string,
): Promise<CompliancePhaseResult> {
  const phaseStart = Date.now();
  console.log(`[compliance] starting for ${academicYear} district=${districtId}`);

  const schoolIds = await getSchoolIdsForDistrict(supabase, districtId);
  if (schoolIds.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    return {
      processed: 0,
      new_cases: 0,
      escalations: 0,
      count_updates: 0,
      tier_1: 0,
      tier_2: 0,
      tier_3: 0,
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  const [snapshots, casesData] = await Promise.all([
    fetchAllRows(supabase, (client) =>
      client
        .from("attendance_snapshots")
        .select(
          "student_id, school_id, academic_year, " +
            "days_enrolled, days_present, days_absent, " +
            "days_absent_unexcused, days_truant, " +
            "attendance_rate, is_chronic_absent"
        )
        .eq("academic_year", academicYear)
        .in("school_id", schoolIds)
    ),
    fetchAllRows(supabase, (client) =>
      client
        .from("compliance_cases")
        .select(
          "id, student_id, school_id, academic_year, current_tier, " +
            "tier_1_triggered_at, tier_2_triggered_at, tier_3_triggered_at, " +
            "tier_requirements, created_at"
        )
        .eq("academic_year", academicYear)
        .eq("is_resolved", false)
        .in("school_id", schoolIds)
    ),
  ]);

  const caseIds = casesData.map((c: { id: string }) => c.id);
  const interventionsData = await fetchRowsInChunks<{
    id: string;
    compliance_case_id: string;
    intervention_type: string;
    intervention_date: string;
  }>(
    supabase,
    caseIds,
    (client, chunk) =>
      client
        .from("intervention_log")
        .select("id, compliance_case_id, intervention_type, intervention_date")
        .not("compliance_case_id", "is", null)
        .in("compliance_case_id", chunk),
  );

  console.log(
    `[compliance] fetched ${snapshots.length} snapshots, ` +
      `${casesData.length} cases, ${interventionsData.length} interventions`
  );

  // ---- Index ----
  const interventionsByCase = new Map<string, InterventionRecord[]>();
  for (const row of interventionsData) {
    if (!row.compliance_case_id) continue;
    let records = interventionsByCase.get(row.compliance_case_id);
    if (!records) {
      records = [];
      interventionsByCase.set(row.compliance_case_id, records);
    }
    records.push({
      intervention_type: row.intervention_type,
      conducted_at: row.intervention_date,
    });
  }

  const caseByStudent = new Map<string, ExistingCase>();
  for (const row of casesData) {
    const interventions = interventionsByCase.get(row.id) ?? [];
    caseByStudent.set(row.student_id, {
      id: row.id,
      current_tier: row.current_tier,
      opened_at: row.created_at,
      tier_1_triggered_at: row.tier_1_triggered_at,
      tier_2_triggered_at: row.tier_2_triggered_at,
      tier_3_triggered_at: row.tier_3_triggered_at,
      interventions,
      tier_requirements: row.tier_requirements ?? {},
    });
  }

  // ---- Compute ----
  let processed = 0;
  let newCases = 0;
  let escalations = 0;
  let updates = 0;
  let tier1Count = 0;
  let tier2Count = 0;
  let tier3Count = 0;
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
          tier_2_triggered_at: result.case_data.tier_2_triggered_at ?? null,
          tier_3_triggered_at: result.case_data.tier_3_triggered_at ?? null,
        });
        newCases++;
        tier1Count++;
      } else if (
        result.action === "escalate_case" &&
        result.case_data &&
        result.existing_case_id
      ) {
        const updateData: Record<string, unknown> = {
          current_tier: result.case_data.current_tier,
          unexcused_absence_count: result.case_data.unexcused_count,
          truancy_count: result.case_data.truancy_count,
          total_absence_count: result.case_data.total_absences,
        };
        if (result.case_data.tier_1_triggered_at)
          updateData.tier_1_triggered_at = result.case_data.tier_1_triggered_at;
        if (result.case_data.tier_2_triggered_at)
          updateData.tier_2_triggered_at = result.case_data.tier_2_triggered_at;
        if (result.case_data.tier_3_triggered_at)
          updateData.tier_3_triggered_at = result.case_data.tier_3_triggered_at;
        // Clear any escalation block on successful escalation
        updateData.escalation_blocked_reason = null;

        escalateOps.push({ caseId: result.existing_case_id, data: updateData });
        escalations++;

        switch (result.case_data.current_tier) {
          case "tier_1_letter":
            tier1Count++;
            break;
          case "tier_2_conference":
            tier2Count++;
            break;
          case "tier_3_sarb_referral":
            tier3Count++;
            break;
        }
      } else if (
        result.action === "update_case" &&
        result.case_data &&
        result.existing_case_id
      ) {
        const countUpdateData: Record<string, unknown> = {
          unexcused_absence_count: result.case_data.unexcused_count,
          truancy_count: result.case_data.truancy_count,
          total_absence_count: result.case_data.total_absences,
        };
        // Persist escalation_blocked_reason if set
        if (result.escalation_blocked_reason) {
          countUpdateData.escalation_blocked_reason = result.escalation_blocked_reason;
        }
        updateOps.push({
          caseId: result.existing_case_id,
          data: countUpdateData,
        });
        updates++;
      }

      processed++;
    } catch (err) {
      console.error(
        `[compliance] error processing student ${snap.student_id}:`,
        err
      );
      errorCount++;
    }
  }

  // ---- Write: inserts ----
  if (inserts.length > 0) {
    const writeErrors = await batchUpsert(
      supabase,
      "compliance_cases",
      inserts,
      "student_id,academic_year",
      "[compliance]"
    );
    if (writeErrors > 0) {
      errorCount += writeErrors;
      newCases -= writeErrors;
    }
  }

  // ---- Write: escalations (individual updates) ----
  for (const op of escalateOps) {
    const { error } = await supabase
      .from("compliance_cases")
      .update(op.data)
      .eq("id", op.caseId);
    if (error) {
      console.error(
        `[compliance] escalation for case ${op.caseId} failed: ${error.message}`
      );
      errorCount++;
      escalations--;
    }
  }

  // ---- Write: count updates (individual updates) ----
  for (const op of updateOps) {
    const { error } = await supabase
      .from("compliance_cases")
      .update(op.data)
      .eq("id", op.caseId);
    if (error) {
      console.error(
        `[compliance] count update for case ${op.caseId} failed: ${error.message}`
      );
      errorCount++;
      updates--;
    }
  }

  const elapsed = (Date.now() - phaseStart) / 1000;
  console.log(
    `[compliance] done: ${processed} processed ` +
      `(${newCases} new, ${escalations} escalated, ${updates} updated, ` +
      `${errorCount} errors) in ${elapsed.toFixed(1)}s`
  );

  return {
    processed,
    new_cases: newCases,
    escalations,
    count_updates: updates,
    tier_1: tier1Count,
    tier_2: tier2Count,
    tier_3: tier3Count,
    error_count: errorCount,
    elapsed_seconds: parseFloat(elapsed.toFixed(1)),
  };
}

/* ------------------------------------------------------------------ */
/* Phase 4: Generate Actions                                           */
/* ------------------------------------------------------------------ */

interface ActionPhaseResult {
  new_actions: number;
  by_type: Record<string, number>;
  error_count: number;
  elapsed_seconds: number;
}

async function runActions(
  supabase: ReturnType<typeof createClient>,
  today: string,
  districtId: string,
): Promise<ActionPhaseResult> {
  const phaseStart = Date.now();
  console.log(`[actions] starting action generation district=${districtId}`);

  const schoolIds = await getSchoolIdsForDistrict(supabase, districtId);
  if (schoolIds.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    return {
      new_actions: 0,
      by_type: {},
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  const casesData = await fetchAllRows(supabase, (client) =>
    client
      .from("compliance_cases")
      .select(
        "id, student_id, school_id, current_tier, created_at, " +
          "tier_1_triggered_at, tier_2_triggered_at, tier_3_triggered_at, " +
          "is_resolved, case_workflow_stage, updated_at, truancy_count, monitoring_started_at"
      )
      .eq("is_resolved", false)
      .in("school_id", schoolIds)
  );

  const caseIds = casesData.map((c: { id: string }) => c.id);
  const studentIds = [...new Set(casesData.map((c: { student_id: string }) => c.student_id))];

  const [existingActionsData, riskSignalsData] = await Promise.all([
    fetchRowsInChunks<{
      compliance_case_id: string;
      action_type: string;
      status: string;
    }>(supabase, caseIds, (client, chunk) =>
      client
        .from("actions")
        .select("compliance_case_id, action_type, status")
        .in("compliance_case_id", chunk)
    ),
    fetchRowsInChunks<{
      student_id: string;
      attendance_rate: number | string | null;
      trend_delta: number | string | null;
    }>(supabase, studentIds, (client, chunk) =>
      client
        .from("risk_signals")
        .select("student_id, attendance_rate, trend_delta")
        .in("student_id", chunk)
    ),
  ]);

  console.log(
    `[actions] fetched ${casesData.length} open cases, ${existingActionsData.length} existing actions, ${riskSignalsData.length} risk signals`
  );

  // ---- Map to engine input types ----
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

  // ---- Generate tier-based actions ----
  const newActions = generateActions({
    complianceCases: cases,
    existingActions,
    today,
  });

  // ---- Generate health advisories ----
  // Index risk signals by student_id for O(1) lookup
  const riskByStudent = new Map<string, { attendance_rate: number; trend_delta: number }>();
  for (const r of riskSignalsData) {
    riskByStudent.set(r.student_id, {
      attendance_rate: r.attendance_rate != null ? parseFloat(r.attendance_rate) : 0,
      trend_delta: r.trend_delta != null ? parseFloat(r.trend_delta) : 0,
    });
  }

  const healthContexts: CaseHealthContext[] = casesData.map((c: any) => {
    const risk = riskByStudent.get(c.student_id);
    return {
      compliance_case_id: c.id,
      student_id: c.student_id,
      school_id: c.school_id,
      current_tier: c.current_tier,
      is_resolved: c.is_resolved,
      case_workflow_stage: c.case_workflow_stage,
      updated_at: c.updated_at,
      tier_1_triggered_at: c.tier_1_triggered_at,
      tier_2_triggered_at: c.tier_2_triggered_at,
      tier_3_triggered_at: c.tier_3_triggered_at,
      truancy_count: c.truancy_count ?? 0,
      monitoring_started_at: c.monitoring_started_at ?? null,
      attendance_rate: risk?.attendance_rate ?? null,
      trend_delta: risk?.trend_delta ?? null,
    };
  });

  const advisoryActions = generateAdvisories({
    cases: healthContexts,
    existingActions,
    today,
  });

  const allNewActions = [...newActions, ...advisoryActions];

  console.log(
    `[actions] generated ${newActions.length} tier actions, ${advisoryActions.length} advisories`
  );

  // Tally by type
  const byType: Record<string, number> = {};
  for (const a of allNewActions) {
    byType[a.action_type] = (byType[a.action_type] ?? 0) + 1;
  }

  // ---- Write ----
  let errorCount = 0;
  if (allNewActions.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < allNewActions.length; i += BATCH_SIZE) {
      const batch = allNewActions.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("actions").insert(batch);
      if (error) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.error(`[actions] insert batch ${batchNum} failed: ${error.message}`);
        errorCount += batch.length;
      }
    }
  }

  const elapsed = (Date.now() - phaseStart) / 1000;
  console.log(
    `[actions] done: ${allNewActions.length - errorCount} inserted, ${errorCount} errors in ${elapsed.toFixed(1)}s`
  );

  return {
    new_actions: allNewActions.length - errorCount,
    by_type: byType,
    error_count: errorCount,
    elapsed_seconds: parseFloat(elapsed.toFixed(1)),
  };
}

/* ------------------------------------------------------------------ */
/* Phase 5: Compute Funding Projections                                */
/* ------------------------------------------------------------------ */

interface FundingPhaseResult {
  student_rows: number;
  school_rows: number;
  total_projected_loss: number;
  chronic_students: number;
  error_count: number;
  elapsed_seconds: number;
}

const PER_PUPIL_DAILY_RATE = 65.0;

async function runFunding(
  supabase: ReturnType<typeof createClient>,
  academicYear: string,
  today: string,
  districtId: string,
): Promise<FundingPhaseResult> {
  const phaseStart = Date.now();
  console.log(`[funding] starting for ${academicYear} district=${districtId}`);

  const districtSchoolIds = await getSchoolIdsForDistrict(supabase, districtId);
  if (districtSchoolIds.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    return {
      student_rows: 0,
      school_rows: 0,
      total_projected_loss: 0,
      chronic_students: 0,
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  // ---- Step 1 & 2: Calendar totals and elapsed days ----
  const calendarData = await fetchAllRows(supabase, (client) =>
    client
      .from("school_calendars")
      .select("school_id, calendar_date, is_school_day")
      .eq("academic_year", academicYear)
      .eq("is_school_day", true)
      .in("school_id", districtSchoolIds)
  );

  if (calendarData.length === 0) {
    throw new Error(
      `No school calendar data found for ${academicYear}. Import attendance first.`
    );
  }

  const totalDaysBySchool = new Map<string, number>();
  const elapsedDaysBySchool = new Map<string, number>();

  for (const row of calendarData) {
    totalDaysBySchool.set(
      row.school_id,
      (totalDaysBySchool.get(row.school_id) ?? 0) + 1
    );
    if (row.calendar_date <= today) {
      elapsedDaysBySchool.set(
        row.school_id,
        (elapsedDaysBySchool.get(row.school_id) ?? 0) + 1
      );
    }
  }

  // ---- Step 3: Snapshots for district schools ----
  const allSnapshots = await fetchAllRows(supabase, (client) =>
    client
      .from("attendance_snapshots")
      .select(
        "student_id, school_id, days_enrolled, days_absent, " +
          "days_present, attendance_rate, is_chronic_absent"
      )
      .eq("academic_year", academicYear)
      .in("school_id", districtSchoolIds)
  );

  console.log(
    `[funding] fetched ${calendarData.length} calendar days, ` +
      `${allSnapshots.length} snapshots`
  );

  if (allSnapshots.length === 0) {
    const { error: delErr } = await supabase
      .from("funding_projections")
      .delete()
      .in("school_id", districtSchoolIds)
      .eq("academic_year", academicYear);
    if (delErr) {
      console.error(`[funding] delete (no snapshots) failed: ${delErr.message}`);
    }
    const elapsed = (Date.now() - phaseStart) / 1000;
    return {
      student_rows: 0,
      school_rows: 0,
      total_projected_loss: 0,
      chronic_students: 0,
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  // ---- Step 4: Compute per-student projections ----
  const schoolAgg = new Map<
    string,
    { totalStudents: number; chronicCount: number; totalProjectedLoss: number }
  >();

  for (const snap of allSnapshots) {
    if (!schoolAgg.has(snap.school_id)) {
      schoolAgg.set(snap.school_id, {
        totalStudents: 0,
        chronicCount: 0,
        totalProjectedLoss: 0,
      });
    }
    schoolAgg.get(snap.school_id)!.totalStudents++;
  }

  const studentRows: Record<string, unknown>[] = [];
  let totalLoss = 0;
  let errorCount = 0;

  for (const snap of allSnapshots) {
    if (!snap.is_chronic_absent) continue;

    try {
      const totalSchoolDays = totalDaysBySchool.get(snap.school_id) ?? 0;
      const elapsedDays = elapsedDaysBySchool.get(snap.school_id) ?? 0;
      const absenceRate =
        snap.days_enrolled > 0 ? snap.days_absent / snap.days_enrolled : 0;
      const remainingDays = Math.max(0, totalSchoolDays - elapsedDays);
      const projectedAdditionalAbsences = Math.round(absenceRate * remainingDays);
      const totalProjectedAbsentDays = snap.days_absent + projectedAdditionalAbsences;
      const projectedAdaLoss =
        Math.round(totalProjectedAbsentDays * PER_PUPIL_DAILY_RATE * 100) / 100;

      studentRows.push({
        student_id: snap.student_id,
        school_id: snap.school_id,
        academic_year: academicYear,
        per_pupil_daily_rate: PER_PUPIL_DAILY_RATE,
        projected_absent_days: totalProjectedAbsentDays,
        projected_ada_loss: projectedAdaLoss,
        computed_at: new Date().toISOString(),
      });

      const agg = schoolAgg.get(snap.school_id)!;
      agg.chronicCount++;
      agg.totalProjectedLoss += projectedAdaLoss;
      totalLoss += projectedAdaLoss;
    } catch (err) {
      console.error(
        `[funding] error processing student ${snap.student_id}:`,
        err
      );
      errorCount++;
    }
  }

  // ---- Step 5: Clear existing rows for all schools in this district ----
  const { error: deleteError } = await supabase
    .from("funding_projections")
    .delete()
    .in("school_id", districtSchoolIds)
    .eq("academic_year", academicYear);

  if (deleteError) {
    console.error(`[funding] delete failed: ${deleteError.message}`);
  }

  // ---- Step 6: Insert student-level rows ----
  let studentWriteErrors = 0;
  if (studentRows.length > 0) {
    studentWriteErrors = await batchInsertRows(
      supabase,
      "funding_projections",
      studentRows,
      "[funding-students]"
    );
  }

  // ---- Step 7: Insert school-level aggregate rows ----
  const schoolRows: Record<string, unknown>[] = [];
  for (const [schoolId, agg] of schoolAgg) {
    schoolRows.push({
      student_id: null,
      school_id: schoolId,
      academic_year: academicYear,
      per_pupil_daily_rate: PER_PUPIL_DAILY_RATE,
      projected_absent_days: null,
      projected_ada_loss: null,
      total_students: agg.totalStudents,
      total_chronic_absent: agg.chronicCount,
      total_projected_loss: Math.round(agg.totalProjectedLoss * 100) / 100,
      computed_at: new Date().toISOString(),
    });
  }

  let schoolWriteErrors = 0;
  if (schoolRows.length > 0) {
    schoolWriteErrors = await batchInsertRows(
      supabase,
      "funding_projections",
      schoolRows,
      "[funding-schools]"
    );
  }

  const totalErrors = errorCount + studentWriteErrors + schoolWriteErrors;
  const elapsed = (Date.now() - phaseStart) / 1000;

  console.log(
    `[funding] done: ${studentRows.length - studentWriteErrors} student rows, ` +
      `${schoolRows.length - schoolWriteErrors} school rows, ` +
      `total loss $${totalLoss.toFixed(2)}, ${totalErrors} errors ` +
      `in ${elapsed.toFixed(1)}s`
  );

  return {
    student_rows: studentRows.length - studentWriteErrors,
    school_rows: schoolRows.length - schoolWriteErrors,
    total_projected_loss: Math.round(totalLoss * 100) / 100,
    chronic_students: studentRows.length,
    error_count: totalErrors,
    elapsed_seconds: parseFloat(elapsed.toFixed(1)),
  };
}

/**
 * Batch insert helper — writes rows in chunks. Returns count of failures.
 */
async function batchInsertRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: Record<string, unknown>[],
  label: string,
  batchSize = 50
): Promise<number> {
  let errorCount = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      const batchNum = Math.floor(i / batchSize) + 1;
      console.error(`${label}: insert batch ${batchNum} failed: ${error.message}`);
      errorCount += batch.length;
    }
  }
  return errorCount;
}

/* ------------------------------------------------------------------ */
/* Phase 6: Intervention Effectiveness Backfill                        */
/* ------------------------------------------------------------------ */

interface EffectivenessPhaseResult {
  backfilled: number;
  error_count: number;
  elapsed_seconds: number;
}

/**
 * Backfills attendance_rate_after_30d on completed actions.
 *
 * Finds actions where:
 * - status = 'completed'
 * - attendance_rate_before IS NOT NULL (was snapshotted at completion)
 * - attendance_rate_after_30d IS NULL (hasn't been measured yet)
 * - completed_at <= 30 days ago
 *
 * For each, reads the student's current attendance_rate from risk_signals
 * and writes it as the 30-day-after measurement.
 */
async function runEffectivenessBackfill(
  supabase: ReturnType<typeof createClient>,
  today: string,
  districtId: string,
): Promise<EffectivenessPhaseResult> {
  const phaseStart = Date.now();
  console.log(`[effectiveness] starting backfill district=${districtId}`);

  const schoolIds = await getSchoolIdsForDistrict(supabase, districtId);
  if (schoolIds.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    return {
      backfilled: 0,
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  const caseRows = await fetchAllRows(supabase, (client) =>
    client.from("compliance_cases").select("id").in("school_id", schoolIds)
  );
  const caseIds = caseRows.map((r: { id: string }) => r.id);
  if (caseIds.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    console.log(`[effectiveness] no cases in district in ${elapsed.toFixed(1)}s`);
    return {
      backfilled: 0,
      error_count: 0,
      elapsed_seconds: parseFloat(elapsed.toFixed(1)),
    };
  }

  // 30 days ago in ISO format
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString();

  // ---- Fetch eligible actions (scoped to district cases; cap total per run) ----
  const eligibleActions: { id: string; student_id: string }[] = [];
  const MAX_PER_RUN = 500;

  for (let i = 0; i < caseIds.length && eligibleActions.length < MAX_PER_RUN; i += IN_CHUNK_SIZE) {
    const chunk = caseIds.slice(i, i + IN_CHUNK_SIZE);
    const { data: rows, error: fetchErr } = await supabase
      .from("actions")
      .select("id, student_id")
      .eq("status", "completed")
      .not("attendance_rate_before", "is", null)
      .is("attendance_rate_after_30d", null)
      .lte("completed_at", cutoffStr)
      .in("compliance_case_id", chunk)
      .limit(MAX_PER_RUN - eligibleActions.length);

    if (fetchErr) {
      console.error(`[effectiveness] fetch error: ${fetchErr.message}`);
      const elapsed = (Date.now() - phaseStart) / 1000;
      return {
        backfilled: 0,
        error_count: 1,
        elapsed_seconds: parseFloat(elapsed.toFixed(1)),
      };
    }
    if (rows?.length) eligibleActions.push(...rows);
  }

  if (eligibleActions.length === 0) {
    const elapsed = (Date.now() - phaseStart) / 1000;
    console.log(`[effectiveness] no actions to backfill in ${elapsed.toFixed(1)}s`);
    return { backfilled: 0, error_count: 0, elapsed_seconds: parseFloat(elapsed.toFixed(1)) };
  }

  console.log(`[effectiveness] found ${eligibleActions.length} actions to backfill`);

  // ---- Fetch current risk signals for all relevant students ----
  const studentIds = [...new Set(eligibleActions.map((a: any) => a.student_id))];
  const riskMap = new Map<string, number>();

  // Fetch in batches of 100 student IDs
  for (let i = 0; i < studentIds.length; i += 100) {
    const batch = studentIds.slice(i, i + 100);
    const { data: riskRows } = await supabase
      .from("risk_signals")
      .select("student_id, attendance_rate")
      .in("student_id", batch);
    if (riskRows) {
      for (const r of riskRows) {
        if (r.attendance_rate != null) {
          riskMap.set(r.student_id, parseFloat(r.attendance_rate));
        }
      }
    }
  }

  // ---- Update each action ----
  let backfilled = 0;
  let errorCount = 0;

  for (const action of eligibleActions) {
    const afterRate = riskMap.get(action.student_id);
    if (afterRate === undefined) continue; // no risk signal available

    const { error: updateErr } = await supabase
      .from("actions")
      .update({ attendance_rate_after_30d: afterRate })
      .eq("id", action.id);

    if (updateErr) {
      console.error(`[effectiveness] update failed for action ${action.id}: ${updateErr.message}`);
      errorCount++;
    } else {
      backfilled++;
    }
  }

  const elapsed = (Date.now() - phaseStart) / 1000;
  console.log(
    `[effectiveness] done: ${backfilled} backfilled, ${errorCount} errors in ${elapsed.toFixed(1)}s`
  );

  return {
    backfilled,
    error_count: errorCount,
    elapsed_seconds: parseFloat(elapsed.toFixed(1)),
  };
}

/* ------------------------------------------------------------------ */
/* Main handler                                                        */
/* ------------------------------------------------------------------ */

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("run-all-engines: missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return jsonError(500, "Server misconfiguration");
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const auth = await authorizeRunAllEngines(req, supabaseUrl, supabaseAnonKey, body);
  if (!auth.ok) {
    return auth.response;
  }

  const districtId = auth.districtId;

  const totalStart = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const today = toDateStr(now);
    const academicYear = getAcademicYear(now);

    console.log(
      `run-all-engines: starting orchestration for ${academicYear} on ${today} district=${districtId}`
    );

    // ---- Phase 1: Snapshots (must run first — other engines read from it) ----
    let snapshotsResult: SnapshotPhaseResult | { error: string };
    try {
      snapshotsResult = await runSnapshots(
        supabase,
        academicYear,
        today,
        districtId,
      );
    } catch (err) {
      console.error("[snapshots] FATAL:", err);
      snapshotsResult = { error: (err as Error).message };
    }

    // ---- Phase 2: Risk Signals (reads snapshots + attendance_daily) ----
    let riskSignalsResult: RiskSignalPhaseResult | { error: string };
    try {
      riskSignalsResult = await runRiskSignals(
        supabase,
        academicYear,
        today,
        districtId,
      );
    } catch (err) {
      console.error("[risk-signals] FATAL:", err);
      riskSignalsResult = { error: (err as Error).message };
    }

    // ---- Phase 3: Compliance (reads snapshots + compliance_cases) ----
    let complianceResult: CompliancePhaseResult | { error: string };
    try {
      complianceResult = await runCompliance(
        supabase,
        academicYear,
        today,
        districtId,
      );
    } catch (err) {
      console.error("[compliance] FATAL:", err);
      complianceResult = { error: (err as Error).message };
    }

    // ---- Phase 4: Actions (reads compliance_cases + existing actions) ----
    let actionsResult: ActionPhaseResult | { error: string };
    try {
      actionsResult = await runActions(supabase, today, districtId);
    } catch (err) {
      console.error("[actions] FATAL:", err);
      actionsResult = { error: (err as Error).message };
    }

    // ---- Phase 5: Funding (reads snapshots + calendar → funding_projections) ----
    let fundingResult: FundingPhaseResult | { error: string };
    try {
      fundingResult = await runFunding(
        supabase,
        academicYear,
        today,
        districtId,
      );
    } catch (err) {
      console.error("[funding] FATAL:", err);
      fundingResult = { error: (err as Error).message };
    }

    // ---- Phase 6: Effectiveness Backfill (reads risk_signals → updates actions) ----
    let effectivenessResult: EffectivenessPhaseResult | { error: string };
    try {
      effectivenessResult = await runEffectivenessBackfill(
        supabase,
        today,
        districtId,
      );
    } catch (err) {
      console.error("[effectiveness] FATAL:", err);
      effectivenessResult = { error: (err as Error).message };
    }

    // ---- Combined result ----
    const totalMs = Date.now() - totalStart;
    const totalSeconds = parseFloat((totalMs / 1000).toFixed(1));

    console.log(
      `run-all-engines: completed all phases in ${totalSeconds}s`
    );

    return new Response(
      JSON.stringify({
        academic_year: academicYear,
        date: today,
        district_id: districtId,
        snapshots: snapshotsResult,
        risk_signals: riskSignalsResult,
        compliance: complianceResult,
        actions: actionsResult,
        funding: fundingResult,
        effectiveness: effectivenessResult,
        total_elapsed_seconds: totalSeconds,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const totalMs = Date.now() - totalStart;
    console.error(
      `run-all-engines: fatal orchestration error after ${totalMs}ms:`,
      err
    );

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
