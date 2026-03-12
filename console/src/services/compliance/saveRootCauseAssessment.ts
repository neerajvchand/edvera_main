/**
 * Saves the root cause assessment (checkbox grid + narrative)
 * to compliance_cases.root_cause JSONB.
 */
import { supabase } from "@/lib/supabase";
import type { RootCauseAssessment } from "@/types/caseWorkspace";

export async function saveRootCauseAssessment(
  caseId: string,
  assessment: Omit<RootCauseAssessment, "savedAt" | "savedBy">,
): Promise<{ success: boolean; error?: string }> {
  // Validate: at least 1 category checked
  const checkedCategories = Object.values(assessment.categories).filter(
    (c) => c.checked,
  );
  if (checkedCategories.length === 0) {
    return { success: false, error: "At least one root cause category must be selected." };
  }

  // Validate: narrative >= 50 chars
  if (!assessment.narrative || assessment.narrative.trim().length < 50) {
    return {
      success: false,
      error: "Narrative must be at least 50 characters.",
    };
  }

  // Resolve current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let savedBy = "Unknown";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();
    savedBy = profile?.display_name ?? user.email ?? "Unknown";
  }

  const payload: RootCauseAssessment = {
    ...assessment,
    savedAt: new Date().toISOString(),
    savedBy,
  };

  const { error } = await supabase
    .from("compliance_cases")
    .update({ root_cause: payload })
    .eq("id", caseId);

  if (error) {
    console.error("saveRootCauseAssessment error:", error);
    return { success: false, error: "Failed to save root cause assessment." };
  }

  return { success: true };
}
