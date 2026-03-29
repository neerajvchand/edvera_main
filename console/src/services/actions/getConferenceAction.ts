/**
 * Fetch the most recent completed conference action for a case.
 *
 * Used by ConferenceSummaryModal to pre-populate form fields
 * from the conference action's completion_data.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ConferenceActionData {
  completionData: Record<string, unknown>;
  completedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getConferenceAction(
  caseId: string
): Promise<ConferenceActionData | null> {
  try {
    const { data: actions } = await supabase
      .from("actions")
      .select("completion_data, completed_at")
      .eq("compliance_case_id", caseId)
      .in("action_type", [
        "schedule_conference",
        "parent_guardian_conference",
        "conference",
      ])
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1);

    if (!actions || actions.length === 0) return null;

    return {
      completionData: (actions[0].completion_data ?? {}) as Record<
        string,
        unknown
      >,
      completedAt: actions[0].completed_at as string | null,
    };
  } catch (err) {
    throw handleServiceError("load conference action", err);
  }
}
