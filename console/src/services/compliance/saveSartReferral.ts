/**
 * Saves SART referral data to compliance_cases.sart_data JSONB.
 */
import { supabase } from "@/lib/supabase";
import type { SartReferralData } from "@/types/caseWorkspace";

export async function saveSartReferral(
  caseId: string,
  data: Omit<SartReferralData, "referred_by" | "savedAt">,
): Promise<{ success: boolean; error?: string }> {
  // Resolve current user for referred_by
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let referredBy = "Unknown";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();
    referredBy = profile?.display_name ?? user.email ?? "Unknown";
  }

  const payload: SartReferralData = {
    ...data,
    referred_by: referredBy,
    savedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("compliance_cases")
    .update({ sart_data: payload })
    .eq("id", caseId);

  if (error) {
    console.error("saveSartReferral error:", error);
    return { success: false, error: "Failed to save SART referral." };
  }

  return { success: true };
}
