/**
 * Completes an action in the workspace — updates the action record,
 * syncs tier requirements, and returns success so the workspace refetches.
 *
 * Timeline events come from the actions table automatically via
 * the buildTimeline() function in getCaseWorkspace, so we don't need
 * to insert into a separate timeline table.
 */
import { supabase } from "@/lib/supabase";
import {
  syncActionToTierRequirements,
  type TierSyncInput,
} from "@/services/compliance/syncActionToTierRequirements";
import type { ActionCompletionData } from "@/types/action";

// Re-export so existing consumers can import from here
export type { ActionCompletionData } from "@/types/action";

/* ------------------------------------------------------------------ */
/* Tier Gate — EC §48263 requires prior documentation before SARB      */
/* ------------------------------------------------------------------ */

const SARB_ACTION_TYPES = [
  "prepare_sarb_packet",
  "sarb_referral",
  "sarb_packet",
];

/**
 * Checks whether Tier 1 and Tier 2 requirements are satisfied.
 * If not, SARB-related actions cannot be completed per EC §48263.
 * Returns null when gate passes, or an error string when blocked.
 */
async function checkTierGate(
  caseId: string,
  actionType: string
): Promise<string | null> {
  if (!SARB_ACTION_TYPES.includes(actionType)) return null;

  const { data: caseRow } = await supabase
    .from("compliance_cases")
    .select("tier_requirements")
    .eq("id", caseId)
    .single();

  if (!caseRow) return "Case not found";

  const tr = (caseRow.tier_requirements ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const t1 = tr.tier_1 ?? {};
  const t2 = tr.tier_2 ?? {};

  const notifSent = t1.notification_sent as
    | { completed?: boolean }
    | undefined;
  const confHeld = t2.conference_held as { completed?: boolean } | undefined;

  const missing: string[] = [];
  if (!notifSent?.completed) missing.push("Tier 1 notification letter");
  if (!confHeld?.completed) missing.push("Tier 2 conference");

  if (missing.length > 0) {
    return `EC §48263 requires prior documentation: ${missing.join(" and ")} must be completed before SARB referral.`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Main function                                                       */
/* ------------------------------------------------------------------ */

export async function completeAction(
  actionId: string,
  caseId: string,
  completionData: ActionCompletionData
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch the action to get its type and student_id
    const { data: action, error: fetchError } = await supabase
      .from("actions")
      .select("id, action_type, title, compliance_case_id, student_id")
      .eq("id", actionId)
      .single();

    if (fetchError || !action) {
      console.error("completeAction: fetch error", fetchError);
      return { success: false, error: "Action not found" };
    }

    // 1b. Tier gate — block SARB actions when prior tiers incomplete
    const effectiveCaseForGate = action.compliance_case_id ?? caseId;
    if (effectiveCaseForGate) {
      const gateResult = await checkTierGate(
        effectiveCaseForGate,
        action.action_type
      );
      if (gateResult) {
        return { success: false, error: gateResult };
      }
    }

    // 2. Build completion_data JSONB for storage
    const completionJson: Record<string, unknown> = {
      date_completed: completionData.completedAt,
    };
    if (completionData.notes) completionJson.notes = completionData.notes;
    if (completionData.outcome) completionJson.outcome = completionData.outcome;
    if (completionData.method) completionJson.method = completionData.method;
    if (completionData.trackingNumber)
      completionJson.tracking_number = completionData.trackingNumber;
    if (completionData.conferenceDate)
      completionJson.conference_date = completionData.conferenceDate;
    if (completionData.conferenceStatus)
      completionJson.status = completionData.conferenceStatus;
    if (completionData.attendees)
      completionJson.attendees = completionData.attendees;
    if (completionData.resourcesOffered !== undefined)
      completionJson.resources_offered = completionData.resourcesOffered;
    if (completionData.ec48262Notified !== undefined)
      completionJson.consequences_explained = completionData.ec48262Notified;
    if (completionData.commitmentsMade)
      completionJson.commitments = completionData.commitmentsMade;
    if (completionData.followUpDate)
      completionJson.follow_up_date = completionData.followUpDate;

    // 2b. Snapshot current attendance rate for effectiveness tracking
    let attendanceRateBefore: number | null = null;
    if (action.student_id) {
      const { data: riskRow } = await supabase
        .from("risk_signals")
        .select("attendance_rate")
        .eq("student_id", action.student_id)
        .maybeSingle();
      if (riskRow?.attendance_rate != null) {
        attendanceRateBefore = parseFloat(riskRow.attendance_rate);
      }
    }

    // 3. Update the action record
    const { error: updateError } = await supabase
      .from("actions")
      .update({
        status: "completed",
        completion_outcome: completionData.outcome ?? "completed",
        completion_notes: completionData.notes ?? null,
        completion_data: completionJson,
        completed_at: completionData.completedAt,
        ...(attendanceRateBefore !== null && {
          attendance_rate_before: attendanceRateBefore,
        }),
      })
      .eq("id", actionId);

    if (updateError) {
      console.error("completeAction: update error", updateError);
      return { success: false, error: "Failed to update action" };
    }

    // 4. Sync tier requirements if this action has a compliance case
    const effectiveCaseId = action.compliance_case_id ?? caseId;
    if (effectiveCaseId) {
      try {
        const syncInput: TierSyncInput = {
          completedAt: completionData.completedAt,
          resourcesOffered: completionData.resourcesOffered,
          ec48262Notified: completionData.ec48262Notified,
          notes: completionData.notes,
          outcome: completionData.outcome,
          method: completionData.method,
          trackingNumber: completionData.trackingNumber,
          conferenceStatus: completionData.conferenceStatus,
        };
        await syncActionToTierRequirements(
          effectiveCaseId,
          action.action_type,
          syncInput
        );
      } catch (tierErr) {
        // Log but don't fail the whole operation — the action is already marked complete
        console.error(
          "completeAction: tier sync error (non-fatal)",
          tierErr
        );
      }
    }

    return { success: true };
  } catch (e) {
    console.error("completeAction: unexpected error", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unexpected error",
    };
  }
}
