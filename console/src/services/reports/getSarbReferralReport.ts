/**
 * Fetch SARB referral summary.
 *
 * Returns the count of open tier-3 (SARB referral) compliance cases.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { SarbReferralData } from "@/types/reports";

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getSarbReferralReport(): Promise<SarbReferralData> {
  try {
    const { data: cases } = await supabase
      .from("compliance_cases")
      .select("id, current_tier, is_resolved");

    const caseList = cases ?? [];
    const tier3Count = caseList.filter(
      (c) => !c.is_resolved && c.current_tier === "tier_3_sarb_referral"
    ).length;

    return { tier3Count };
  } catch (err) {
    throw handleServiceError("load SARB referral report", err);
  }
}
