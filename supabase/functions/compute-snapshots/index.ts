/**
 * Supabase Edge Function: compute-snapshots
 *
 * Recalculates attendance snapshots for all actively-enrolled students
 * from raw attendance_daily records and school calendars. Results are
 * upserted into the attendance_snapshots table.
 *
 * Usage:
 *   curl -i --location --request POST \
 *     'http://localhost:54321/functions/v1/compute-snapshots' \
 *     --header 'Authorization: Bearer SERVICE_ROLE_KEY'
 *
 * Architecture: This is a thin wrapper around the pure computation engine
 * in _shared/snapshot-engine.ts. All attendance math lives there so it
 * can be tested independently. This file handles Supabase I/O only.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeSnapshot,
  type AttendanceRecord,
  type CalendarDay,
} from "../_shared/snapshot-engine.ts";

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
 *
 * @param buildQuery - A function that receives the Supabase client and
 *   returns a fresh query builder (must be called per page since the
 *   builder is consumed on execution).
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
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const academicYear = getAcademicYear(now);

    console.log(
      `compute-snapshots: starting for academic year ${academicYear}, date ${today}`
    );

    // ---- Bulk data fetching (3 paginated queries in parallel) ----
    const [enrollments, attendanceData, calendarData] = await Promise.all([
      // 1. Active enrollments (leave_date IS NULL = currently enrolled)
      fetchAllRows(supabase, (client) =>
        client
          .from("enrollments")
          .select("student_id, school_id, academic_year, enter_date, leave_date")
          .eq("academic_year", academicYear)
          .is("leave_date", null)
      ),

      // 2. All attendance_daily records for the academic year
      //    (could be 50k+ rows for a large district — pagination handles it)
      fetchAllRows(supabase, (client) =>
        client
          .from("attendance_daily")
          .select(
            "student_id, calendar_date, canonical_type, counts_for_ada, counts_as_truancy"
          )
      ),

      // 3. School calendars for the academic year
      fetchAllRows(supabase, (client) =>
        client
          .from("school_calendars")
          .select("school_id, calendar_date, is_school_day")
          .eq("academic_year", academicYear)
      ),
    ]);

    console.log(
      `compute-snapshots: fetched ${enrollments.length} enrollments, ` +
        `${attendanceData.length} attendance records, ` +
        `${calendarData.length} calendar days`
    );

    // ---- Index data into Maps for O(1) per-student lookup ----

    // Attendance: Map<student_id, AttendanceRecord[]>
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

    // Calendar: Map<school_id, CalendarDay[]>
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

    // ---- Process each student ----

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

        // Map to the columns that exist in the attendance_snapshots table.
        // Extra computed fields (absence_rate, attendance_band, ada_eligible_days,
        // truancy_count) are not stored — they live in the engine output and
        // can be recomputed on read.
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
          days_independent_study_complete:
            snapshot.days_independent_study_complete,
          days_independent_study_incomplete:
            snapshot.days_independent_study_incomplete,
          attendance_rate: snapshot.attendance_rate,
          ada_rate: snapshot.ada_rate,
          is_chronic_absent: snapshot.is_chronic_absent,
          computed_at: new Date().toISOString(),
        });

        if (snapshot.is_chronic_absent) chronicCount++;
        processed++;
      } catch (err) {
        console.error(
          `compute-snapshots: error processing student ${enrollment.student_id}:`,
          err
        );
        errorCount++;
      }
    }

    // ---- Batch upsert into attendance_snapshots ----
    // Upsert on (student_id, academic_year) unique constraint.
    // Process in batches of 50 to stay well within Supabase payload limits.

    const BATCH_SIZE = 50;
    for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
      const batch = dbRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("attendance_snapshots")
        .upsert(batch, { onConflict: "student_id,academic_year" });

      if (error) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.error(
          `compute-snapshots: upsert batch ${batchNum} failed: ${error.message}`
        );
        // Count these as errors but don't abort — other batches may succeed
        errorCount += batch.length;
        processed -= batch.length;
      }
    }

    // ---- Summary ----
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `compute-snapshots: processed ${processed} students in ${elapsed}s ` +
        `(${chronicCount} chronic, ${errorCount} errors)`
    );

    return new Response(
      JSON.stringify({
        processed,
        chronic_count: chronicCount,
        error_count: errorCount,
        academic_year: academicYear,
        snapshot_date: today,
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
      `compute-snapshots: fatal error after ${elapsed}s:`,
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
