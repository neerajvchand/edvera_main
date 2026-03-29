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
/* Advisory input types                                                */
/* ------------------------------------------------------------------ */

/** Extended case data for health advisory evaluation (joins risk_signals). */
export interface CaseHealthContext {
  compliance_case_id: string;
  student_id: string;
  school_id: string;
  current_tier: string;
  is_resolved: boolean;
  case_workflow_stage: string;
  updated_at: string; // ISO timestamp
  tier_1_triggered_at: string | null;
  tier_2_triggered_at: string | null;
  tier_3_triggered_at: string | null;
  truancy_count: number;
  monitoring_started_at: string | null; // ISO timestamp, set when case enters monitoring
  attendance_rate: number | null; // from risk_signals join
  trend_delta: number | null; // from risk_signals join
}

/** Input to the advisory generator. */
export interface AdvisoryGeneratorInput {
  cases: CaseHealthContext[];
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
  improvement_detected: 5,
  stale_case: 5,
  plateau_detected: 5,
  monitoring_resolution: 5,
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

/* ------------------------------------------------------------------ */
/* Advisory generation — case health signals                           */
/* ------------------------------------------------------------------ */

/** Truancy count thresholds for the NEXT tier (used by plateau check). */
const NEXT_TIER_THRESHOLD: Record<string, number> = {
  tier_1_letter: 6,
  tier_2_conference: 9,
};

/** Stages that should not trigger stale-case advisories. */
const STALE_EXEMPT_STAGES = new Set(["closed", "ready_for_board", "monitoring_period"]);

/**
 * Computes the number of full days between two ISO date/timestamp strings.
 */
function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Generates advisory actions based on case health signals.
 *
 * Unlike tier-based actions, advisories surface conditions that require
 * human judgment: attendance improvement (consider closing), stale cases
 * (no activity), and attendance plateaus (current interventions ineffective).
 *
 * Uses the same dedup pattern as generateActions() — one advisory per
 * type per case, skipping cancelled actions only.
 *
 * @param params - Case health contexts, existing actions, and today's date
 * @returns Array of new advisory actions to create
 */
export function generateAdvisories(params: AdvisoryGeneratorInput): NewAction[] {
  const { cases, existingActions, today } = params;

  // Dedup set: same pattern as generateActions
  const existingSet = new Set<string>();
  for (const ea of existingActions) {
    if (ea.compliance_case_id && ea.status !== "cancelled") {
      existingSet.add(`${ea.compliance_case_id}::${ea.action_type}`);
    }
  }

  // Index case IDs that have at least one open action (for stale check)
  const casesWithOpenActions = new Set<string>();
  for (const ea of existingActions) {
    if (ea.compliance_case_id && ea.status === "open") {
      casesWithOpenActions.add(ea.compliance_case_id);
    }
  }

  const advisories: NewAction[] = [];
  const dueDate = addBusinessDays(today, DUE_DAYS.improvement_detected);

  for (const c of cases) {
    if (c.is_resolved) continue;

    // --- 1. Improvement detected ---
    if (
      c.attendance_rate !== null &&
      c.trend_delta !== null &&
      c.trend_delta >= 5.0 &&
      c.attendance_rate > 90
    ) {
      const key = `${c.compliance_case_id}::improvement_detected`;
      if (!existingSet.has(key)) {
        const beforeRate = Math.round((c.attendance_rate - c.trend_delta) * 10) / 10;
        advisories.push({
          student_id: c.student_id,
          school_id: c.school_id,
          compliance_case_id: c.compliance_case_id,
          action_type: "improvement_detected",
          title: "Review for resolution — attendance improved",
          description:
            `Attendance rose from ${beforeRate}% to ${c.attendance_rate}% over the last 30 days and is now above 90%. ` +
            `This case may be ready for resolution.`,
          reason:
            `Student attendance improved from ${beforeRate}% to ${c.attendance_rate}%. Consider closing this case.`,
          priority: "normal",
          due_date: dueDate,
        });
        existingSet.add(key); // prevent duplicates within this run
      }
    }

    // --- 2. Stale case ---
    if (!STALE_EXEMPT_STAGES.has(c.case_workflow_stage)) {
      const daysSinceUpdate = daysBetween(c.updated_at, today);
      if (daysSinceUpdate >= 30 && !casesWithOpenActions.has(c.compliance_case_id)) {
        const key = `${c.compliance_case_id}::stale_case`;
        if (!existingSet.has(key)) {
          const tierLabel = c.current_tier.replace(/_/g, " ").replace("tier ", "Tier ");
          advisories.push({
            student_id: c.student_id,
            school_id: c.school_id,
            compliance_case_id: c.compliance_case_id,
            action_type: "stale_case",
            title: "Stale case — no activity in 30+ days",
            description:
              `This ${tierLabel} case has had no activity for ${daysSinceUpdate} days ` +
              `and has no open actions. Review the case status and determine next steps.`,
            reason:
              `No actions logged for ${daysSinceUpdate} days. Review case status.`,
            priority: "high",
            due_date: dueDate,
          });
          existingSet.add(key);
        }
      }
    }

    // --- 3. Plateau detected ---
    if (
      c.attendance_rate !== null &&
      c.trend_delta !== null &&
      c.attendance_rate < 85 &&
      c.trend_delta >= -2.0 &&
      c.trend_delta <= 2.0
    ) {
      // Determine how long the case has been at its current tier
      let tierStartDate: string | null = null;
      if (c.current_tier === "tier_1_letter") tierStartDate = c.tier_1_triggered_at;
      else if (c.current_tier === "tier_2_conference") tierStartDate = c.tier_2_triggered_at;
      else if (c.current_tier === "tier_3_sarb_referral") tierStartDate = c.tier_3_triggered_at;

      if (tierStartDate) {
        const daysSinceTier = daysBetween(tierStartDate, today);
        const nextThreshold = NEXT_TIER_THRESHOLD[c.current_tier];

        // Only flag plateau if at same tier 45+ days AND hasn't reached next tier threshold
        // Skip tier_3 entirely — no next tier to escalate to
        if (
          daysSinceTier >= 45 &&
          nextThreshold !== undefined &&
          c.truancy_count < nextThreshold
        ) {
          const key = `${c.compliance_case_id}::plateau_detected`;
          if (!existingSet.has(key)) {
            advisories.push({
              student_id: c.student_id,
              school_id: c.school_id,
              compliance_case_id: c.compliance_case_id,
              action_type: "plateau_detected",
              title: "Attendance plateau — consider alternative intervention",
              description:
                `Attendance has been flat at ${c.attendance_rate}% for ${daysSinceTier} days ` +
                `at the current tier. Current interventions may not be effective. ` +
                `Consider a different approach or barrier assessment.`,
              reason:
                `Attendance flat at ${c.attendance_rate}% for ${daysSinceTier} days. Current interventions may not be effective.`,
              priority: "high",
              due_date: dueDate,
            });
            existingSet.add(key);
          }
        }
      }
    }

    // --- 4. Monitoring period resolution ---
    if (
      c.case_workflow_stage === "monitoring_period" &&
      c.monitoring_started_at &&
      c.attendance_rate !== null &&
      c.attendance_rate > 90
    ) {
      const daysInMonitoring = daysBetween(c.monitoring_started_at, today);
      if (daysInMonitoring >= 30) {
        const key = `${c.compliance_case_id}::monitoring_resolution`;
        if (!existingSet.has(key)) {
          advisories.push({
            student_id: c.student_id,
            school_id: c.school_id,
            compliance_case_id: c.compliance_case_id,
            action_type: "monitoring_resolution",
            title: "Monitoring complete — recommend case resolution",
            description:
              `Student has maintained ${c.attendance_rate}% attendance for ${daysInMonitoring} days ` +
              `during the monitoring period. This case is ready for resolution.`,
            reason:
              `Monitoring period complete (${daysInMonitoring} days). Attendance sustained at ${c.attendance_rate}%. Recommend closing.`,
            priority: "normal",
            due_date: dueDate,
          });
          existingSet.add(key);
        }
      }
    }
  }

  return advisories;
}
