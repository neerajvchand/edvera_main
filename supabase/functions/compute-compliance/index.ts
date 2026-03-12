/**
 * Supabase Edge Function: compute-compliance
 *
 * Evaluates truancy and chronic absence thresholds for all actively-enrolled
 * students and creates or escalates compliance cases. Results are written
 * to the compliance_cases table.
 *
 * This function should be run AFTER compute-snapshots, not before.
 * The compliance engine reads attendance_snapshots as input.
 *
 * Usage:
 *   curl -i --location --request POST \
 *     'http://localhost:54321/functions/v1/compute-compliance' \
 *     --header 'Authorization: Bearer SERVICE_ROLE_KEY'
 *
 * Architecture: This is a thin wrapper around the pure computation engine
 * in _shared/compliance-engine.ts. All California Ed Code compliance logic
 * lives there so it can be tested independently. This file handles
 * Supabase I/O only.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  evaluateCompliance,
  type ComplianceSnapshot,
  type ExistingCase,
  type InterventionRecord,
} from "../_shared/compliance-engine.ts";

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

serve(async (_req: Request) => {
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
      `compute-compliance: starting for academic year ${academicYear}, date ${today}`
    );

    // ---- Bulk data fetching (3 paginated queries in parallel) ----
    const [snapshots, casesData, interventionsData] = await Promise.all([
      // 1. Current attendance snapshots (computed by compute-snapshots)
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
      ),

      // 2. Existing open compliance cases for the academic year
      //    (is_resolved = false means the case is still open)
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
      ),

      // 3. All intervention log entries for the academic year
      //    (we'll group by compliance_case_id)
      fetchAllRows(supabase, (client) =>
        client
          .from("intervention_log")
          .select(
            "id, compliance_case_id, intervention_type, intervention_date"
          )
          .not("compliance_case_id", "is", null)
      ),
    ]);

    console.log(
      `compute-compliance: fetched ${snapshots.length} snapshots, ` +
        `${casesData.length} open cases, ` +
        `${interventionsData.length} interventions`
    );

    // ---- Index data into Maps ----

    // Interventions: Map<compliance_case_id, InterventionRecord[]>
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

    // Existing cases: Map<student_id, ExistingCase>
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

    // ---- Process each student snapshot ----

    let processed = 0;
    let newCases = 0;
    let escalations = 0;
    let updates = 0;
    let tier1Count = 0;
    let tier2Count = 0;
    let tier3Count = 0;
    let errorCount = 0;

    // Collect write operations grouped by type
    const inserts: Record<string, unknown>[] = [];
    const escalateOps: Array<{
      caseId: string;
      data: Record<string, unknown>;
    }> = [];
    const updateOps: Array<{
      caseId: string;
      data: Record<string, unknown>;
    }> = [];

    for (const snap of snapshots) {
      try {
        const existingCase = caseByStudent.get(snap.student_id) ?? null;

        // Compute absence rate from snapshot data (not stored in DB)
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
          academicYear: academicYear,
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
          tier1Count++; // new cases always start at tier 1
        } else if (result.action === "escalate_case" && result.case_data && result.existing_case_id) {
          const updateData: Record<string, unknown> = {
            current_tier: result.case_data.current_tier,
            unexcused_absence_count: result.case_data.unexcused_count,
            truancy_count: result.case_data.truancy_count,
            total_absence_count: result.case_data.total_absences,
          };
          // Set the appropriate tier timestamp
          if (result.case_data.tier_1_triggered_at) {
            updateData.tier_1_triggered_at = result.case_data.tier_1_triggered_at;
          }
          if (result.case_data.tier_2_triggered_at) {
            updateData.tier_2_triggered_at = result.case_data.tier_2_triggered_at;
          }
          if (result.case_data.tier_3_triggered_at) {
            updateData.tier_3_triggered_at = result.case_data.tier_3_triggered_at;
          }
          // Clear any escalation block on successful escalation
          updateData.escalation_blocked_reason = null;

          escalateOps.push({
            caseId: result.existing_case_id,
            data: updateData,
          });
          escalations++;

          // Tally by tier
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
        } else if (result.action === "update_case" && result.case_data && result.existing_case_id) {
          const updateData: Record<string, unknown> = {
            unexcused_absence_count: result.case_data.unexcused_count,
            truancy_count: result.case_data.truancy_count,
            total_absence_count: result.case_data.total_absences,
          };
          // Persist or clear escalation_blocked_reason
          if (result.escalation_blocked_reason) {
            updateData.escalation_blocked_reason = result.escalation_blocked_reason;
          }
          updateOps.push({
            caseId: result.existing_case_id,
            data: updateData,
          });
          updates++;
        }

        processed++;
      } catch (err) {
        console.error(
          `compute-compliance: error processing student ${snap.student_id}:`,
          err
        );
        errorCount++;
      }
    }

    // ---- Execute writes ----

    // 1. Batch insert new cases (upsert on student_id + academic_year)
    if (inserts.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("compliance_cases")
          .upsert(batch, { onConflict: "student_id,academic_year" });

        if (error) {
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          console.error(
            `compute-compliance: insert batch ${batchNum} failed: ${error.message}`
          );
          errorCount += batch.length;
          newCases -= batch.length;
        }
      }
    }

    // 2. Escalation updates (individual updates — each case has unique data)
    for (const op of escalateOps) {
      const { error } = await supabase
        .from("compliance_cases")
        .update(op.data)
        .eq("id", op.caseId);

      if (error) {
        console.error(
          `compute-compliance: escalation for case ${op.caseId} failed: ${error.message}`
        );
        errorCount++;
        escalations--;
      }
    }

    // 3. Count updates (individual updates)
    for (const op of updateOps) {
      const { error } = await supabase
        .from("compliance_cases")
        .update(op.data)
        .eq("id", op.caseId);

      if (error) {
        console.error(
          `compute-compliance: count update for case ${op.caseId} failed: ${error.message}`
        );
        errorCount++;
        updates--;
      }
    }

    // ---- Summary ----
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `compute-compliance: processed ${processed} students in ${elapsed}s ` +
        `(${newCases} new cases, ${escalations} escalations, ${updates} count updates, ` +
        `${errorCount} errors)`
    );

    return new Response(
      JSON.stringify({
        processed,
        new_cases: newCases,
        escalations,
        count_updates: updates,
        tier_1: tier1Count,
        tier_2: tier2Count,
        tier_3: tier3Count,
        error_count: errorCount,
        academic_year: academicYear,
        date: today,
        elapsed_seconds: parseFloat(elapsed),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(
      `compute-compliance: fatal error after ${elapsed}s:`,
      err
    );

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
