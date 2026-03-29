/**
 * Supabase Edge Function: compute-risk-signals
 *
 * Evaluates attendance trajectories for all actively-enrolled students
 * and classifies each as stable, softening, or elevated. Results are
 * upserted into the risk_signals table.
 *
 * This function should be run AFTER compute-snapshots, not before.
 * The risk engine reads snapshot data as input.
 *
 * Usage:
 *   curl -i --location --request POST \
 *     'http://localhost:54321/functions/v1/compute-risk-signals' \
 *     --header 'Authorization: Bearer SERVICE_ROLE_KEY'
 *
 * Architecture: This is a thin wrapper around the pure computation engine
 * in _shared/risk-engine.ts. All classification logic lives there so it
 * can be tested independently. This file handles Supabase I/O only.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeRiskSignal,
  type SnapshotData,
  type AttendanceWindow,
  type ExistingSignal,
  type SignalLevel,
} from "../_shared/risk-engine.ts";

/* ------------------------------------------------------------------ */
/* CORS headers                                                        */
/* ------------------------------------------------------------------ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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
    if (data.length < pageSize) break; // last page
    from += pageSize;
  }

  return allRows;
}

/**
 * Derives the current academic year string from a date.
 * California school years run roughly July–June.
 * - March 2026 → "2025-2026"
 * - September 2025 → "2025-2026"
 */
function getAcademicYear(date: Date): string {
  const year =
    date.getMonth() >= 6 // July (index 6) starts new academic year
      ? date.getFullYear()
      : date.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

/**
 * Formats a Date to ISO date string (YYYY-MM-DD).
 */
function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Canonical types that count as present for the day.
 * Must match the classification in snapshot-engine.ts.
 */
const PRESENT_TYPES = new Set([
  "present",
  "tardy",
  "tardy_excused",
  "tardy_unexcused",
  "independent_study_complete",
]);

/**
 * Canonical types that count as absent for the day.
 */
const ABSENT_TYPES = new Set([
  "absent_unverified",
  "absent_excused",
  "absent_unexcused",
  "suspension_in_school",
  "suspension_out_of_school",
  "independent_study_incomplete",
]);

/**
 * Builds an AttendanceWindow from a set of attendance records and
 * calendar days within a specified date range.
 *
 * @param records - All attendance records for the student (will be filtered)
 * @param calendarDays - All school calendar days (will be filtered)
 * @param startDate - Start of the window (inclusive), ISO string
 * @param endDate - End of the window (inclusive), ISO string
 * @returns Computed attendance window metrics
 */
function buildWindow(
  records: Array<{ date: string; canonical_type: string }>,
  calendarDays: Array<{ date: string; is_school_day: boolean }>,
  startDate: string,
  endDate: string
): AttendanceWindow {
  // Count instructional days in the window
  const schoolDaysInWindow = calendarDays.filter(
    (d) => d.is_school_day && d.date >= startDate && d.date <= endDate
  );
  const daysEnrolled = schoolDaysInWindow.length;

  // Build a set of school days for O(1) lookup
  const schoolDaySet = new Set(schoolDaysInWindow.map((d) => d.date));

  // Filter records to only those on instructional days within the window
  const windowRecords = records.filter((r) => schoolDaySet.has(r.date));

  let daysPresent = 0;
  let daysAbsent = 0;

  for (const record of windowRecords) {
    if (PRESENT_TYPES.has(record.canonical_type)) daysPresent++;
    if (ABSENT_TYPES.has(record.canonical_type)) daysAbsent++;
  }

  // Compute consecutive absences at the tail (most recent streak)
  // Sort school days descending by date, then walk backward
  const sortedSchoolDays = [...schoolDaysInWindow].sort(
    (a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)
  );

  // Build a map of date → canonical_type for quick lookup
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
      break; // streak broken
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
/* Main handler                                                        */
/* ------------------------------------------------------------------ */

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ---- Supabase client (service role — bypasses RLS) ----
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const today = toDateStr(now);
    const academicYear = getAcademicYear(now);

    // ---- Date windows ----
    // Recent window: last 30 calendar days → today
    const recent30Start = new Date(now);
    recent30Start.setDate(recent30Start.getDate() - 30);
    const recentStartStr = toDateStr(recent30Start);

    // Prior window: 31–60 calendar days ago
    const prior60Start = new Date(now);
    prior60Start.setDate(prior60Start.getDate() - 60);
    const priorStartStr = toDateStr(prior60Start);
    // Prior ends the day before recent starts
    const priorEnd = new Date(recent30Start);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorEndStr = toDateStr(priorEnd);

    console.log(
      `compute-risk-signals: starting for ${academicYear}, ` +
        `recent window ${recentStartStr}–${today}, ` +
        `prior window ${priorStartStr}–${priorEndStr}`
    );

    // ---- Bulk data fetching (4 paginated queries in parallel) ----
    const [snapshots, attendanceData, calendarData, existingSignals] =
      await Promise.all([
        // 1. Current attendance snapshots (computed by compute-snapshots)
        fetchAllRows(supabase, (client) =>
          client
            .from("attendance_snapshots")
            .select(
              "student_id, school_id, academic_year, days_enrolled, days_present, days_absent, attendance_rate, is_chronic_absent"
            )
            .eq("academic_year", academicYear)
        ),

        // 2. Attendance records for the 60-day window
        //    We need both recent (0–30 days) and prior (31–60 days)
        fetchAllRows(supabase, (client) =>
          client
            .from("attendance_daily")
            .select("student_id, calendar_date, canonical_type")
            .gte("calendar_date", priorStartStr)
            .lte("calendar_date", today)
        ),

        // 3. School calendar for the 60-day window
        fetchAllRows(supabase, (client) =>
          client
            .from("school_calendars")
            .select("school_id, calendar_date, is_school_day")
            .gte("calendar_date", priorStartStr)
            .lte("calendar_date", today)
        ),

        // 4. Existing risk signals (for anti-flicker logic)
        fetchAllRows(supabase, (client) =>
          client.from("risk_signals").select("student_id, signal_level")
        ),
      ]);

    console.log(
      `compute-risk-signals: fetched ${snapshots.length} snapshots, ` +
        `${attendanceData.length} attendance records (60-day window), ` +
        `${calendarData.length} calendar days, ` +
        `${existingSignals.length} existing signals`
    );

    // ---- Index data into Maps for O(1) per-student lookup ----

    // Attendance: Map<student_id, Array<{date, canonical_type}>>
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

    // Calendar: Map<school_id, Array<{date, is_school_day}>>
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

    // Existing signals: Map<student_id, ExistingSignal>
    const existingByStudent = new Map<string, ExistingSignal>();
    for (const row of existingSignals) {
      existingByStudent.set(row.student_id, {
        signal_level: row.signal_level as SignalLevel,
      });
    }

    // ---- Process each student snapshot ----

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

        // Build the two 30-day windows
        const recentWindow = buildWindow(
          studentRecords,
          schoolCalendar,
          recentStartStr,
          today
        );

        const priorWindow = buildWindow(
          studentRecords,
          schoolCalendar,
          priorStartStr,
          priorEndStr
        );

        // Map snapshot to engine input format
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

        // Map to the columns in the risk_signals table
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

        // Tally by level
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
          `compute-risk-signals: error processing student ${snap.student_id}:`,
          err
        );
        errorCount++;
      }
    }

    // ---- Batch upsert into risk_signals ----
    // Upsert on (student_id) unique constraint.
    // Process in batches of 50 to stay within Supabase payload limits.

    const BATCH_SIZE = 50;
    for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
      const batch = dbRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("risk_signals")
        .upsert(batch, { onConflict: "student_id" });

      if (error) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.error(
          `compute-risk-signals: upsert batch ${batchNum} failed: ${error.message}`
        );
        // Count these as errors but don't abort — other batches may succeed
        errorCount += batch.length;
        processed -= batch.length;
      }
    }

    // ---- Summary ----
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `compute-risk-signals: processed ${processed} students in ${elapsed}s ` +
        `(${elevatedCount} elevated, ${softeningCount} softening, ` +
        `${stableCount} stable, ${pendingCount} pending, ${errorCount} errors)`
    );

    return new Response(
      JSON.stringify({
        processed,
        elevated: elevatedCount,
        softening: softeningCount,
        stable: stableCount,
        pending: pendingCount,
        error_count: errorCount,
        academic_year: academicYear,
        date: today,
        elapsed_seconds: parseFloat(elapsed),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(
      `compute-risk-signals: fatal error after ${elapsed}s:`,
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
