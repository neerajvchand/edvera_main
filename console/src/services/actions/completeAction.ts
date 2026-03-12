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
/* Attribution — resolve current user's display name + role            */
/* ------------------------------------------------------------------ */

async function getAttribution(): Promise<{
  userId: string;
  name: string;
  role: string;
} | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("user_id", user.id)
      .single();

    return {
      userId: user.id,
      name: profile?.display_name ?? user.email ?? "Unknown",
      role: profile?.role ?? "staff",
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Tier Gate — per-tier prerequisite checks                            */
/* ------------------------------------------------------------------ */

const TIER_2_ACTION_TYPES = [
  "followup_call",
  "follow_up_call",
  "follow_up_contact",
  "phone_call",
  "schedule_conference",
  "parent_guardian_conference",
  "conference",
  "sart_action",
];

const TIER_3_ACTION_TYPES = [
  "prepare_sarb_packet",
  "sarb_referral",
  "sarb_packet",
];

/**
 * Checks per-tier prerequisites before allowing action completion.
 * - Tier 1 actions: no prerequisites (always allowed)
 * - Tier 2 actions: require Tier 1 notification_sent
 * - Tier 3 actions: require Tier 1 notification_sent + Tier 2 conference_held
 * Returns null when gate passes, or an error string when blocked.
 */
async function checkTierGate(
  caseId: string,
  actionType: string
): Promise<string | null> {
  const isTier2 = TIER_2_ACTION_TYPES.includes(actionType);
  const isTier3 = TIER_3_ACTION_TYPES.includes(actionType);
  if (!isTier2 && !isTier3) return null;

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

  if (isTier2) {
    if (!notifSent?.completed) {
      return "Tier 1 notification letter must be sent before Tier 2 actions can be completed (EC §48260.5).";
    }
    return null;
  }

  // Tier 3 — require T1, T2, and SART meeting + follow-up
  const missing: string[] = [];
  if (!notifSent?.completed) missing.push("Tier 1 notification letter");
  if (!confHeld?.completed) missing.push("Tier 2 parent/guardian conference");

  // Check for SART meeting and follow-up in intervention_log
  const { data: sartInterventions } = await supabase
    .from("intervention_log")
    .select("intervention_type")
    .eq("compliance_case_id", caseId)
    .in("intervention_type", ["sart_meeting", "sart_followup"]);

  const types = (sartInterventions ?? []).map((r: { intervention_type: string }) => r.intervention_type);
  if (!types.includes("sart_meeting")) missing.push("SART meeting");
  if (!types.includes("sart_followup")) missing.push("SART 30-day follow-up");

  if (missing.length > 0) {
    return `EC §48263 requires prior documentation: ${missing.join(", ")} must be completed before SARB referral.`;
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
    // 1. Fetch the action to get its type
    const { data: action, error: fetchError } = await supabase
      .from("actions")
      .select("id, action_type, title, compliance_case_id")
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

    // 3. Resolve attribution for the current user
    const attribution = await getAttribution();

    // 4. Update the action record
    const { error: updateError } = await supabase
      .from("actions")
      .update({
        status: "completed",
        completion_outcome: completionData.outcome ?? "completed",
        completion_notes: completionData.notes ?? null,
        completion_data: completionJson,
        completed_at: completionData.completedAt,
        completed_by: attribution?.userId ?? null,
        completed_by_name: attribution?.name ?? null,
        completed_by_role: attribution?.role ?? null,
      })
      .eq("id", actionId);

    if (updateError) {
      console.error("completeAction: update error", updateError);
      return { success: false, error: "Failed to update action" };
    }

    // 5. Sync tier requirements if this action has a compliance case
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
