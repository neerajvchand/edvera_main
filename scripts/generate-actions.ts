/**
 * Generates initial actions from existing compliance cases.
 *
 * Run this once after creating the actions table to populate it with
 * actions derived from the seed data's compliance cases.
 *
 * Usage: npx tsx scripts/generate-actions.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  generateActions,
  type ComplianceCaseInput,
  type ExistingAction,
} from "../supabase/functions/_shared/action-generator.ts";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAllRows(
  buildQuery: (client: typeof supabase) => any,
  pageSize = 1000
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(supabase).range(from, from + pageSize - 1);
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  console.log("🔧 Generating actions from compliance cases...\n");

  // Fetch compliance cases and existing actions in parallel
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

  console.log(`  Found ${casesData.length} open compliance cases`);
  console.log(`  Found ${existingActionsData.length} existing actions`);

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

  console.log(`  Generated ${newActions.length} new actions\n`);

  if (newActions.length === 0) {
    console.log("  No new actions to insert.");
    return;
  }

  // Tally by type
  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const a of newActions) {
    byType[a.action_type] = (byType[a.action_type] ?? 0) + 1;
    byPriority[a.priority] = (byPriority[a.priority] ?? 0) + 1;
  }

  console.log("  By type:");
  for (const [type, count] of Object.entries(byType)) {
    console.log(`    ${type}: ${count}`);
  }
  console.log("  By priority:");
  for (const [priority, count] of Object.entries(byPriority)) {
    console.log(`    ${priority}: ${count}`);
  }
  console.log();

  // Insert in batches
  const BATCH_SIZE = 200;
  let inserted = 0;
  for (let i = 0; i < newActions.length; i += BATCH_SIZE) {
    const batch = newActions.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("actions").insert(batch);
    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Inserted ${inserted} actions in ${elapsed}s`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
