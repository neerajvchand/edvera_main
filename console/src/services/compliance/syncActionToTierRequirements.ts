/**
 * Atomic tier-requirements writeback.
 *
 * Reads the current tier_requirements JSONB from the compliance case,
 * merges in the new completion data for the given action type, and
 * writes the result back. Never overwrites sibling keys.
 */
import { supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface TierSyncInput {
  completedAt: string;
  resourcesOffered?: boolean;
  ec48262Notified?: boolean;
  notes?: string;
  outcome?: string;
  method?: string;
  trackingNumber?: string;
  conferenceStatus?: string;
}

interface TierRequirementEntry {
  completed: boolean;
  completedAt: string | null;
  [key: string]: unknown;
}

type TierRequirements = Record<string, Record<string, unknown>>;

/* ------------------------------------------------------------------ */
/* Action type → canonical mapping                                     */
/* ------------------------------------------------------------------ */

function canonicalType(raw: string): string {
  switch (raw) {
    case "send_letter":
    case "send_truancy_letter":
    case "truancy_notification":
    case "send_notification_letter":
      return "send_letter";
    case "followup_call":
    case "follow_up_call":
    case "follow_up_contact":
    case "phone_call":
      return "follow_up_call";
    case "schedule_conference":
    case "parent_guardian_conference":
    case "conference":
      return "schedule_conference";
    case "prepare_sarb_packet":
    case "sarb_referral":
    case "sarb_packet":
      return "prepare_sarb_packet";
    default:
      return raw;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeEntry(
  existing: unknown,
  completedAt: string,
  extra?: Record<string, unknown>
): TierRequirementEntry {
  const base =
    existing && typeof existing === "object" && existing !== null
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return {
    ...base,
    completed: true,
    completedAt,
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Main function                                                       */
/* ------------------------------------------------------------------ */

export async function syncActionToTierRequirements(
  caseId: string,
  actionType: string,
  completionData: TierSyncInput
): Promise<{ success: boolean; updatedRequirements: TierRequirements }> {
  // 1. Read current tier_requirements
  const { data: currentCase, error: fetchError } = await supabase
    .from("compliance_cases")
    .select("tier_requirements")
    .eq("id", caseId)
    .single();

  if (fetchError) {
    console.error("syncActionToTierRequirements: fetch error", fetchError);
    throw fetchError;
  }

  const current: TierRequirements =
    (currentCase?.tier_requirements as TierRequirements) ?? {};

  // Ensure nested tiers exist
  const tier1 = { ...(current.tier_1 ?? {}) } as Record<string, unknown>;
  const tier2 = { ...(current.tier_2 ?? {}) } as Record<string, unknown>;
  const tier3 = { ...(current.tier_3 ?? {}) } as Record<string, unknown>;

  const canonical = canonicalType(actionType);
  const now = completionData.completedAt;

  // 2. Apply updates based on action type
  switch (canonical) {
    case "send_letter":
      // Both Tier 1 items complete when letter is sent
      tier1.notification_sent = makeEntry(tier1.notification_sent, now, {
        method: completionData.method ?? null,
        trackingNumber: completionData.trackingNumber ?? null,
      });
      tier1.notification_language_compliant = makeEntry(
        tier1.notification_language_compliant,
        now
      );
      break;

    case "follow_up_call":
      // Follow-up call confirms Tier 1 notification was made
      tier1.notification_sent = makeEntry(tier1.notification_sent, now, {
        outcome: completionData.outcome ?? null,
      });
      break;

    case "schedule_conference": {
      // Route to conference_held or conference_attempted based on status
      const status = completionData.conferenceStatus;
      const isAttempted =
        status === "attempted_no_response" || status === "held_parent_absent";

      if (isAttempted) {
        // Conference was attempted but parent didn't attend / didn't respond.
        // This satisfies the tier 2 requirement per EC §48262 (good-faith effort).
        tier2.conference_attempted = makeEntry(tier2.conference_attempted, now, {
          conferenceStatus: status,
        });
      } else {
        // Conference was held with parent present
        tier2.conference_held = makeEntry(tier2.conference_held, now);
      }

      if (completionData.resourcesOffered) {
        tier2.resources_offered = makeEntry(tier2.resources_offered, now);
      }
      if (completionData.ec48262Notified) {
        tier2.consequences_explained = makeEntry(
          tier2.consequences_explained,
          now
        );
      }
      break;
    }

    case "prepare_sarb_packet":
      tier3.packet_assembled = makeEntry(tier3.packet_assembled, now);
      break;

    default:
      // No tier_requirements update for unknown action types
      return { success: true, updatedRequirements: current };
  }

  // 3. Merge back
  const updated: TierRequirements = {
    ...current,
    tier_1: tier1,
    tier_2: tier2,
    tier_3: tier3,
  };

  // 4. Write back
  const { error: updateError } = await supabase
    .from("compliance_cases")
    .update({ tier_requirements: updated })
    .eq("id", caseId);

  if (updateError) {
    console.error("syncActionToTierRequirements: update error", updateError);
    throw updateError;
  }

  return { success: true, updatedRequirements: updated };
}
