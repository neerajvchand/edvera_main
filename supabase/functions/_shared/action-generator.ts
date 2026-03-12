/**
 * Pure computation engine for generating compliance actions.
 *
 * Zero runtime dependencies — takes compliance case data and existing actions,
 * returns new actions to create. All action generation logic lives here so it
 * can be tested independently without Supabase or Deno.
 *
 * Actions are tasks generated automatically when the compliance engine detects
 * threshold crossings. Each compliance tier maps to specific required actions
 * per California Education Code.
 *
 * @module action-generator
 */

/* ------------------------------------------------------------------ */
/* Input types                                                         */
/* ------------------------------------------------------------------ */

/** A compliance case from the compliance_cases table. */
export interface ComplianceCaseInput {
  id: string;
  student_id: string;
  school_id: string;
  current_tier: string;
  created_at: string; // ISO timestamp
  tier_1_triggered_at: string | null;
  tier_2_triggered_at: string | null;
  tier_3_triggered_at: string | null;
  is_resolved: boolean;
}

/** An existing action from the actions table. */
export interface ExistingAction {
  compliance_case_id: string | null;
  action_type: string;
  status: string;
}

/** Input to the action generator. */
export interface ActionGeneratorInput {
  complianceCases: ComplianceCaseInput[];
  existingActions: ExistingAction[];
  today: string; // ISO date string YYYY-MM-DD
}

/* ------------------------------------------------------------------ */
/* Output types                                                        */
/* ------------------------------------------------------------------ */

/** A new action to be created. */
export interface NewAction {
  student_id: string;
  school_id: string;
  compliance_case_id: string;
  action_type: string;
  title: string;
  description: string;
  reason: string;
  priority: string;
  due_date: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Business days to add for due dates by action type. */
const DUE_DAYS: Record<string, number> = {
  send_letter: 5,
  follow_up_call: 3,
  schedule_conference: 10,
  prepare_sarb_packet: 15,
  review_case: 7,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Adds N calendar days to an ISO date string, skipping weekends.
 * Returns an ISO date string (YYYY-MM-DD).
 */
function addBusinessDays(fromDate: string, days: number): string {
  const d = new Date(fromDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Determines priority based on due date and tier.
 */
function computePriority(dueDate: string, tier: string, today: string): string {
  if (dueDate <= today) return "urgent";
  // Within 3 days
  const dueDateObj = new Date(dueDate);
  const todayObj = new Date(today);
  const daysUntilDue = Math.floor(
    (dueDateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (tier === "tier_3_sarb_referral" || daysUntilDue <= 3) return "high";
  return "normal";
}

/* ------------------------------------------------------------------ */
/* Action templates by tier                                            */
/* ------------------------------------------------------------------ */

interface ActionTemplate {
  action_type: string;
  title: string;
  description: string;
  reason: string;
  dueDaysKey: string;
}

const TIER_1_ACTIONS: ActionTemplate[] = [
  {
    action_type: "send_letter",
    title: "Send truancy notification letter to parent/guardian",
    description:
      "Generate and mail the first truancy notification letter. Include: dates of unexcused absences, legal obligations, available support resources, and consequences of continued absence.",
    reason:
      "3 unexcused absences — first notification required per EC §48260.5",
    dueDaysKey: "send_letter",
  },
];

const TIER_2_ACTIONS: ActionTemplate[] = [
  {
    action_type: "follow_up_call",
    title: "Follow-up call to parent/guardian",
    description:
      "Call parent/guardian to verify receipt of notification letter and discuss attendance concerns. Document call outcome and any barriers to attendance identified.",
    reason: "Verify receipt of notification and discuss attendance support",
    dueDaysKey: "follow_up_call",
  },
  {
    action_type: "schedule_conference",
    title: "Schedule parent/guardian conference",
    description:
      "Arrange and conduct a formal attendance conference with the student and parent/guardian. This meeting fulfills the 'conscientious effort' requirement before SARB referral. Document attendance, discussion, and agreed-upon action plan.",
    reason:
      "Habitual truancy — conscientious effort meeting required per EC §48262",
    dueDaysKey: "schedule_conference",
  },
];

const TIER_3_ACTIONS: ActionTemplate[] = [
  {
    action_type: "prepare_sarb_packet",
    title: "Prepare SARB referral packet",
    description:
      "Compile the complete SARB referral packet including: attendance history, copies of notification letters, conference documentation, intervention log, and any relevant family circumstances. Submit to district SARB coordinator.",
    reason:
      "Continued truancy after conference — SARB referral per EC §48263",
    dueDaysKey: "prepare_sarb_packet",
  },
];

/* ------------------------------------------------------------------ */
/* Core generation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generates new actions from compliance cases.
 *
 * For each open compliance case, determines what actions should exist
 * based on the current tier, then checks existing actions to avoid
 * creating duplicates.
 *
 * **Tier mapping:**
 * - tier_1_letter → send_letter (due: 5 business days from trigger)
 * - tier_2_conference → follow_up_call (3 days) + schedule_conference (10 days)
 * - tier_3_sarb_referral → prepare_sarb_packet (15 days)
 *
 * @param params - Compliance cases, existing actions, and today's date
 * @returns Array of new actions to create
 */
export function generateActions(params: ActionGeneratorInput): NewAction[] {
  const { complianceCases, existingActions, today } = params;

  // Index existing actions by (compliance_case_id, action_type) for O(1) dedup
  const existingSet = new Set<string>();
  for (const ea of existingActions) {
    if (ea.compliance_case_id) {
      // Only consider non-cancelled actions as "existing"
      if (ea.status !== "cancelled") {
        existingSet.add(`${ea.compliance_case_id}::${ea.action_type}`);
      }
    }
  }

  const newActions: NewAction[] = [];

  for (const caseData of complianceCases) {
    if (caseData.is_resolved) continue;

    // Determine which action templates apply for this tier
    let templates: ActionTemplate[] = [];
    let triggerDate: string;

    switch (caseData.current_tier) {
      case "tier_1_letter":
        templates = TIER_1_ACTIONS;
        triggerDate = caseData.tier_1_triggered_at ?? caseData.created_at;
        break;
      case "tier_2_conference":
        templates = [...TIER_1_ACTIONS, ...TIER_2_ACTIONS];
        triggerDate = caseData.tier_2_triggered_at ?? caseData.created_at;
        break;
      case "tier_3_sarb_referral":
        templates = [...TIER_1_ACTIONS, ...TIER_2_ACTIONS, ...TIER_3_ACTIONS];
        triggerDate = caseData.tier_3_triggered_at ?? caseData.created_at;
        break;
      default:
        continue;
    }

    // Extract just the date portion from ISO timestamp
    const triggerDateStr = triggerDate.slice(0, 10);

    for (const template of templates) {
      const key = `${caseData.id}::${template.action_type}`;
      if (existingSet.has(key)) continue; // already exists, skip

      // Determine trigger date for due calculation:
      // - tier_1 actions use tier_1_triggered_at
      // - tier_2 actions use tier_2_triggered_at
      // - tier_3 actions use tier_3_triggered_at
      let actionTriggerDate: string;
      if (
        template.action_type === "send_letter" &&
        caseData.tier_1_triggered_at
      ) {
        actionTriggerDate = caseData.tier_1_triggered_at.slice(0, 10);
      } else if (
        (template.action_type === "follow_up_call" ||
          template.action_type === "schedule_conference") &&
        caseData.tier_2_triggered_at
      ) {
        actionTriggerDate = caseData.tier_2_triggered_at.slice(0, 10);
      } else if (
        template.action_type === "prepare_sarb_packet" &&
        caseData.tier_3_triggered_at
      ) {
        actionTriggerDate = caseData.tier_3_triggered_at.slice(0, 10);
      } else {
        actionTriggerDate = triggerDateStr;
      }

      const dueDate = addBusinessDays(
        actionTriggerDate,
        DUE_DAYS[template.dueDaysKey] ?? 7
      );
      const priority = computePriority(dueDate, caseData.current_tier, today);

      newActions.push({
        student_id: caseData.student_id,
        school_id: caseData.school_id,
        compliance_case_id: caseData.id,
        action_type: template.action_type,
        title: template.title,
        description: template.description,
        reason: template.reason,
        priority,
        due_date: dueDate,
      });
    }
  }

  return newActions;
}
