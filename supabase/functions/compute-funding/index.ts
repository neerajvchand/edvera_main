/**
 * Supabase Edge Function: compute-funding
 *
 * Computes funding projections (projected ADA loss) from attendance snapshots
 * and school calendar data. Writes both student-level and school-level
 * aggregate rows to the funding_projections table.
 *
 * This function should be run AFTER compute-snapshots, since it reads
 * attendance_snapshots as input.
 *
 * Usage:
 *   curl -i --location --request POST \
 *     'http://localhost:54321/functions/v1/compute-funding' \
 *     --header 'Authorization: Bearer SERVICE_ROLE_KEY'
 *
 * Architecture: Thin I/O wrapper. Reads snapshots + calendars, computes
 * projected ADA loss per chronic student, aggregates per school, and
 * writes both granularities to funding_projections.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PER_PUPIL_DAILY_RATE = 65.0; // California average ~$65/day

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
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

/**
 * Derives the current academic year string from a date.
 * California school years run roughly July–June.
 */
function getAcademicYear(date: Date): string {
  const year =
    date.getMonth() >= 6
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
    const today = now.toISOString().split("T")[0];
    const academicYear = getAcademicYear(now);

    console.log(
      `compute-funding: starting for academic year ${academicYear}, date ${today}`
    );

    // ================================================================
    // Step 1 & 2: Get school calendar totals and elapsed days
    // ================================================================

    const calendarData = await fetchAllRows(supabase, (client) =>
      client
        .from("school_calendars")
        .select("school_id, calendar_date, is_school_day")
        .eq("academic_year", academicYear)
        .eq("is_school_day", true)
    );

    if (calendarData.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(
        `compute-funding: no school calendar data found for ${academicYear}`
      );
      return new Response(
        JSON.stringify({
          error: `No school calendar data found for academic year ${academicYear}. ` +
            `Import attendance data first to generate the calendar.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Total school days per school (full year)
    const totalDaysBySchool = new Map<string, number>();
    // Elapsed school days per school (up to today)
    const elapsedDaysBySchool = new Map<string, number>();

    for (const row of calendarData) {
      // Count total days
      totalDaysBySchool.set(
        row.school_id,
        (totalDaysBySchool.get(row.school_id) ?? 0) + 1
      );
      // Count elapsed days (up to today)
      if (row.calendar_date <= today) {
        elapsedDaysBySchool.set(
          row.school_id,
          (elapsedDaysBySchool.get(row.school_id) ?? 0) + 1
        );
      }
    }

    console.log(
      `compute-funding: calendar loaded for ${totalDaysBySchool.size} schools`
    );

    // ================================================================
    // Step 3: Get ALL attendance snapshots (need all for school totals)
    //         and identify chronic students for loss projection
    // ================================================================

    const allSnapshots = await fetchAllRows(supabase, (client) =>
      client
        .from("attendance_snapshots")
        .select(
          "student_id, school_id, days_enrolled, days_absent, " +
            "days_present, attendance_rate, is_chronic_absent"
        )
        .eq("academic_year", academicYear)
    );

    console.log(
      `compute-funding: fetched ${allSnapshots.length} snapshots`
    );

    if (allSnapshots.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `compute-funding: no snapshots found, nothing to compute (${elapsed}s)`
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: "No students found for this academic year",
          student_rows: 0,
          school_rows: 0,
          total_projected_loss: 0,
          elapsed_seconds: parseFloat(elapsed),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // ================================================================
    // Step 4: Compute per-student projected ADA loss (chronic only)
    // ================================================================

    // Track school-level aggregates
    const schoolAgg = new Map<
      string,
      {
        totalStudents: number;
        chronicCount: number;
        totalProjectedLoss: number;
      }
    >();

    // Initialize school aggregates for every school that has students
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
        const totalSchoolDays =
          totalDaysBySchool.get(snap.school_id) ?? 0;
        const elapsedDays =
          elapsedDaysBySchool.get(snap.school_id) ?? 0;

        // Absence rate based on days enrolled so far
        const absenceRate =
          snap.days_enrolled > 0
            ? snap.days_absent / snap.days_enrolled
            : 0;

        // Remaining instructional days in the year
        const remainingDays = Math.max(0, totalSchoolDays - elapsedDays);

        // Project additional absences at current rate
        const projectedAdditionalAbsences = Math.round(
          absenceRate * remainingDays
        );

        // Total projected absent days (actual + projected)
        const totalProjectedAbsentDays =
          snap.days_absent + projectedAdditionalAbsences;

        // ADA loss = absent days × per-pupil daily rate
        const projectedAdaLoss = Math.round(
          totalProjectedAbsentDays * PER_PUPIL_DAILY_RATE * 100
        ) / 100;

        studentRows.push({
          student_id: snap.student_id,
          school_id: snap.school_id,
          academic_year: academicYear,
          per_pupil_daily_rate: PER_PUPIL_DAILY_RATE,
          projected_absent_days: totalProjectedAbsentDays,
          projected_ada_loss: projectedAdaLoss,
          computed_at: new Date().toISOString(),
        });

        // Accumulate school aggregates
        const agg = schoolAgg.get(snap.school_id)!;
        agg.chronicCount++;
        agg.totalProjectedLoss += projectedAdaLoss;
        totalLoss += projectedAdaLoss;
      } catch (err) {
        console.error(
          `compute-funding: error processing student ${snap.student_id}:`,
          err
        );
        errorCount++;
      }
    }

    console.log(
      `compute-funding: computed ${studentRows.length} student projections, ` +
        `total loss $${totalLoss.toFixed(2)}`
    );

    // ================================================================
    // Step 5: Clear existing rows for this academic year
    // ================================================================

    // Get all school IDs that have snapshots
    const schoolIds = [...schoolAgg.keys()];

    if (schoolIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("funding_projections")
        .delete()
        .in("school_id", schoolIds)
        .eq("academic_year", academicYear);

      if (deleteError) {
        console.error(
          `compute-funding: delete failed: ${deleteError.message}`
        );
        // Continue anyway — upserts will still work
      }
    }

    // ================================================================
    // Step 6: Insert student-level rows
    // ================================================================

    let studentWriteErrors = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < studentRows.length; i += BATCH_SIZE) {
      const batch = studentRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("funding_projections")
        .insert(batch);

      if (error) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.error(
          `compute-funding: student insert batch ${batchNum} failed: ${error.message}`
        );
        studentWriteErrors += batch.length;
      }
    }

    // ================================================================
    // Step 7: Insert school-level aggregate rows (student_id = NULL)
    // ================================================================

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
        total_projected_loss:
          Math.round(agg.totalProjectedLoss * 100) / 100,
        computed_at: new Date().toISOString(),
      });
    }

    let schoolWriteErrors = 0;

    for (let i = 0; i < schoolRows.length; i += BATCH_SIZE) {
      const batch = schoolRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("funding_projections")
        .insert(batch);

      if (error) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.error(
          `compute-funding: school insert batch ${batchNum} failed: ${error.message}`
        );
        schoolWriteErrors += batch.length;
      }
    }

    // ---- Summary ----
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalErrors = errorCount + studentWriteErrors + schoolWriteErrors;

    console.log(
      `compute-funding: done in ${elapsed}s — ` +
        `${studentRows.length - studentWriteErrors} student rows, ` +
        `${schoolRows.length - schoolWriteErrors} school rows, ` +
        `total loss $${totalLoss.toFixed(2)}, ${totalErrors} errors`
    );

    return new Response(
      JSON.stringify({
        student_rows: studentRows.length - studentWriteErrors,
        school_rows: schoolRows.length - schoolWriteErrors,
        total_projected_loss: Math.round(totalLoss * 100) / 100,
        chronic_students: studentRows.length,
        total_students: allSnapshots.length,
        schools: schoolRows.length,
        error_count: totalErrors,
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
      `compute-funding: fatal error after ${elapsed}s:`,
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
