/**
 * Fetch compliance status summary.
 *
 * Returns open-case tier counts and action completion stats.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { ComplianceStatusData } from "@/types/reports";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getComplianceStatusReport(): Promise<ComplianceStatusData> {
  try {
    const [{ data: cases }, { data: actions }] = await Promise.all([
      supabase
        .from("compliance_cases")
        .select("id, current_tier, is_resolved"),
      supabase
        .from("actions")
        .select("id, status, due_date, completed_at"),
    ]);

    const caseList = cases ?? [];
    const actionList = actions ?? [];

    const openCases = caseList.filter((c) => !c.is_resolved);
    const tier1Count = openCases.filter(
      (c) => c.current_tier === "tier_1_letter"
    ).length;
    const tier2Count = openCases.filter(
      (c) => c.current_tier === "tier_2_conference"
    ).length;
    const tier3Count = openCases.filter(
      (c) => c.current_tier === "tier_3_sarb_referral"
    ).length;

    const today = todayISO();
    const actionsCompletedCount = actionList.filter(
      (a) => a.status === "completed"
    ).length;
    const actionsOverdueCount = actionList.filter(
      (a) => a.status === "open" && a.due_date < today
    ).length;

    return {
      tier1Count,
      tier2Count,
      tier3Count,
      totalOpenCases: openCases.length,
      actionsCompletedCount,
      actionsOverdueCount,
    };
  } catch (err) {
    throw handleServiceError("load compliance status report", err);
  }
}
