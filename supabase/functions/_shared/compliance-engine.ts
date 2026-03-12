/**
 * Pure computation engine for SARB compliance case evaluation.
 *
 * Zero runtime dependencies — takes plain data in, returns plain results out.
 * All California truancy and chronic absence compliance logic lives here
 * so it can be unit-tested without Supabase, Deno, or any other platform
 * dependency.
 *
 * Implements two parallel compliance tracks per California Education Code:
 *
 * **Track 1 — Truancy (EC §48260–48263)**
 *   Triggered by unexcused absences / tardies. Escalates through three
 *   tiers: notification letter → parent conference → SARB referral.
 *
 * **Track 2 — Chronic Absence (EC §60901)**
 *   Triggered by total absence rate ≥ 10%. Separate from truancy because
 *   ALL absence types count (excused + unexcused + suspensions).
 *
 * Both tracks can apply to the same student. The engine always produces
 * the HIGHER tier between the two tracks.
 *
 * @module compliance-engine
 */

/* ------------------------------------------------------------------ */
/* Input types                                                         */
/* ------------------------------------------------------------------ */

/** Attendance snapshot data needed for compliance evaluation. */
export interface ComplianceSnapshot {
  days_enrolled: number;
  days_absent: number;
  days_absent_unexcused: number;
  /** Computed absence rate: (days_absent / days_enrolled) * 100 */
  absence_rate: number;
  is_chronic_absent: boolean;
  /**
   * Count of truancy events (from attendance_daily.counts_as_truancy).
   * Per EC §48260: 3+ unexcused absences or unexcused tardies > 30 min.
   */
  truancy_count: number;
  /** Total absent days (all types). */
  total_absences: number;
}

/** A single intervention from the intervention_log table. */
export interface InterventionRecord {
  intervention_type: string;
  /** ISO date string (YYYY-MM-DD) of when the intervention was conducted. */
  conducted_at: string;
}

/** An existing open compliance case for the student, if any. */
export interface ExistingCase {
  id: string;
  current_tier: string;
  /** ISO timestamp string — when the case was first created. */
  opened_at: string;
  /** ISO timestamp string — when tier 1 was triggered (null if never). */
  tier_1_triggered_at: string | null;
  /** ISO timestamp string — when tier 2 was triggered (null if never). */
  tier_2_triggered_at: string | null;
  /** ISO timestamp string — when tier 3 was triggered (null if never). */
  tier_3_triggered_at: string | null;
  /** All interventions logged against this case. */
  interventions: InterventionRecord[];
  /** Structured tier requirement completion data from action completions. */
  tier_requirements?: Record<string, unknown>;
}

/** All inputs needed to evaluate compliance for one student. */
export interface ComplianceInput {
  studentId: string;
  schoolId: string;
  academicYear: string;
  snapshot: ComplianceSnapshot;
  existingCase: ExistingCase | null;
  /** ISO date string (YYYY-MM-DD) — the evaluation date. */
  today: string;
}

/* ------------------------------------------------------------------ */
/* Output types                                                        */
/* ------------------------------------------------------------------ */

/** The action the wrapper should take for this student. */
export type ComplianceAction =
  | "none"
  | "create_case"
  | "escalate_case"
  | "update_case";

/** Data for creating or updating a compliance case. */
export interface CaseData {
  student_id: string;
  school_id: string;
  academic_year: string;
  current_tier: string;
  reason: string;
  unexcused_count: number;
  truancy_count: number;
  total_absences: number;
  absence_rate: number;
  /** Set when the tier is being assigned/escalated. */
  tier_1_triggered_at?: string;
  tier_2_triggered_at?: string;
  tier_3_triggered_at?: string;
}

/** Result of evaluating compliance for a single student. */
export interface ComplianceResult {
  student_id: string;
  school_id: string;
  action: ComplianceAction;
  case_data: CaseData | null;
  /** If escalating, explains why. */
  escalation_reason: string | null;
  /** The existing case ID, if updating/escalating. */
  existing_case_id: string | null;
  /** If escalation was blocked by missing tier requirements, explains why. */
  escalation_blocked_reason: string | null;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Tier enum values matching the PostgreSQL compliance_tier type. */
const TIER_NONE = "none";
const TIER_1 = "tier_1_letter";
const TIER_2 = "tier_2_conference";
const TIER_3 = "tier_3_sarb_referral";

/** Tier ordering for comparison (higher = more severe). */
const TIER_RANK: Record<string, number> = {
  [TIER_NONE]: 0,
  [TIER_1]: 1,
  [TIER_2]: 2,
  [TIER_3]: 3,
};

/**
 * Minimum days between tier 1 trigger and tier 2 escalation.
 * Gives time for the notification letter to be received and acted upon.
 */
const TIER_1_TO_2_MIN_DAYS = 14;

/**
 * Minimum days between tier 2 trigger and tier 3 escalation.
 * Allows time for the parent conference and "conscientious effort"
 * requirement of EC §48262 to be met.
 */
const TIER_2_TO_3_MIN_DAYS = 30;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Calculates the number of calendar days between two ISO date strings.
 * Returns a positive number if `later` is after `earlier`.
 */
function daysBetween(earlier: string, later: string): number {
  const d1 = new Date(earlier);
  const d2 = new Date(later);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the higher of two tier strings based on TIER_RANK.
 */
function higherTier(a: string, b: string): string {
  return (TIER_RANK[a] ?? 0) >= (TIER_RANK[b] ?? 0) ? a : b;
}

/**
 * Checks if the case has at least one intervention with a type
 * containing "conference" or "meeting" — the "conscientious effort"
 * requirement of EC §48262 before SARB referral.
 */
function hasConferenceIntervention(interventions: InterventionRecord[]): boolean {
  return interventions.some((i) => {
    const lower = i.intervention_type.toLowerCase();
    return lower.includes("conference") || lower.includes("meeting");
  });
}

/* ------------------------------------------------------------------ */
/* Tier requirements gating                                            */
/* ------------------------------------------------------------------ */

/**
 * Checks whether Tier 1 requirements have been completed:
 * - Notification letter sent with required legal language.
 */
function isTier1RequirementsMet(tierReqs: Record<string, unknown>): boolean {
  const t1 = tierReqs?.tier_1 as Record<string, unknown> | undefined;
  if (!t1) return false;

  const notifSent = t1.notification_sent as Record<string, unknown> | undefined;
  return !!(notifSent?.completed && t1.notification_language_compliant);
}

/**
 * Checks whether Tier 2 requirements have been completed:
 * - Conference held or at least attempted, AND consequences explained.
 */
function isTier2RequirementsMet(tierReqs: Record<string, unknown>): boolean {
  const t2 = tierReqs?.tier_2 as Record<string, unknown> | undefined;
  if (!t2) return false;

  const confHeld = t2.conference_held as Record<string, unknown> | undefined;
  const confAttempted = t2.conference_attempted as Record<string, unknown> | undefined;
  const hasConference = !!(confHeld?.completed || confAttempted?.completed);
  return hasConference && !!t2.consequences_explained;
}

/**
 * Determines if escalation from the current tier to the next tier is
 * blocked by incomplete tier requirements. Returns a human-readable
 * reason string if blocked, or null if requirements are met.
 */
function getEscalationBlockedReason(
  nextTier: string,
  tierReqs: Record<string, unknown> | undefined
): string | null {
  if (!tierReqs || Object.keys(tierReqs).length === 0) {
    // No tier requirements data at all — block with generic reason
    if (nextTier === TIER_2) {
      return "Cannot escalate: Tier 1 notification has not been sent";
    }
    if (nextTier === TIER_3) {
      return "Cannot escalate: Parent conference has not been attempted (EC §48262)";
    }
    return null;
  }

  if (nextTier === TIER_2 && !isTier1RequirementsMet(tierReqs)) {
    const t1 = tierReqs?.tier_1 as Record<string, unknown> | undefined;
    const missing: string[] = [];
    const notifSent = t1?.notification_sent as Record<string, unknown> | undefined;
    if (!notifSent?.completed) missing.push("Tier 1 notification not yet sent");
    if (!t1?.notification_language_compliant) missing.push("legal language not confirmed");
    return `Cannot escalate: ${missing.join(", ")}`;
  }

  if (nextTier === TIER_3 && !isTier2RequirementsMet(tierReqs)) {
    const t2 = tierReqs?.tier_2 as Record<string, unknown> | undefined;
    const missing: string[] = [];
    const confHeld = t2?.conference_held as Record<string, unknown> | undefined;
    const confAttempted = t2?.conference_attempted as Record<string, unknown> | undefined;
    if (!confHeld?.completed && !confAttempted?.completed) {
      missing.push("parent conference has not been attempted");
    }
    if (!t2?.consequences_explained) missing.push("consequences not discussed per EC §48262");
    return `Cannot escalate: ${missing.join(", ")}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Track 1: Truancy evaluation (EC §48260–48263)                       */
/* ------------------------------------------------------------------ */

/**
 * Evaluates the truancy track and returns the appropriate tier and reason.
 *
 * **Tier 1** (notification_letter): truancy_count >= 3
 *   - EC §48260.5: "Upon a pupil's initial classification as a truant,
 *     the school district shall notify the pupil's parent or guardian."
 *
 * **Tier 2** (parent_conference): truancy_count >= 6
 *   - EC §48262: Requires a conference with the pupil and parent/guardian.
 *   - Must be at least 14 days after tier 1 (letter receipt time).
 *
 * **Tier 3** (sarb_referral): truancy_count >= 9 OR absence_rate >= 20%
 *   - EC §48263: Referral to SARB or district mediation.
 *   - Requires at least one conference/meeting intervention logged.
 *   - Must be at least 30 days after tier 2.
 */
function evaluateTruancyTrack(
  snapshot: ComplianceSnapshot,
  existingCase: ExistingCase | null,
  today: string
): { tier: string; reason: string | null } {
  const { truancy_count, absence_rate } = snapshot;

  // ---- Tier 3 check ----
  if (truancy_count >= 9 || (truancy_count >= 6 && absence_rate >= 20)) {
    if (existingCase && existingCase.current_tier === TIER_2) {
      // Check time gate: at least 30 days since tier 2
      const tier2Date = existingCase.tier_2_triggered_at ?? existingCase.opened_at;
      if (daysBetween(tier2Date, today) >= TIER_2_TO_3_MIN_DAYS) {
        // Check conscientious effort: must have a conference/meeting logged
        if (hasConferenceIntervention(existingCase.interventions)) {
          const trigger =
            truancy_count >= 9
              ? `${truancy_count} truancy events`
              : `${truancy_count} truancy events with ${absence_rate.toFixed(1)}% absence rate`;
          return {
            tier: TIER_3,
            reason:
              `${trigger} — SARB referral required per EC §48263. ` +
              `Conscientious effort documented; conference/meeting on record.`,
          };
        }
        // Conference not yet documented — can't escalate to tier 3
      }
      // Not enough time has passed — stay at tier 2
    }
    // If not at tier 2, fall through to lower tier checks
  }

  // ---- Tier 2 check ----
  if (truancy_count >= 6) {
    if (existingCase && existingCase.current_tier === TIER_1) {
      // Check time gate: at least 14 days since tier 1
      const tier1Date = existingCase.tier_1_triggered_at ?? existingCase.opened_at;
      if (daysBetween(tier1Date, today) >= TIER_1_TO_2_MIN_DAYS) {
        return {
          tier: TIER_2,
          reason:
            `${truancy_count} truancy events (reported truant 3+ times) — ` +
            `parent conference required per EC §48262`,
        };
      }
      // Not enough time — stay at tier 1
    }
    // If no case or already at tier 2+, fall through
  }

  // ---- Tier 1 check ----
  if (truancy_count >= 3) {
    return {
      tier: TIER_1,
      reason:
        `${truancy_count} unexcused absences — truancy notification required per EC §48260.5`,
    };
  }

  // Not truant
  return { tier: TIER_NONE, reason: null };
}

/* ------------------------------------------------------------------ */
/* Track 2: Chronic absence evaluation (EC §60901)                     */
/* ------------------------------------------------------------------ */

/**
 * Evaluates the chronic absence track and returns the appropriate tier
 * and reason.
 *
 * **Tier 1**: is_chronic_absent (absence_rate >= 10%)
 *   - Notification and early intervention.
 *
 * **Tier 2**: absence_rate >= 20% (severe chronic)
 *   - Escalated intervention, conference required.
 */
function evaluateChronicTrack(
  snapshot: ComplianceSnapshot,
  existingCase: ExistingCase | null
): { tier: string; reason: string | null } {
  const { is_chronic_absent, absence_rate } = snapshot;

  // ---- Severe chronic: tier 2 ----
  if (is_chronic_absent && absence_rate >= 20) {
    if (existingCase && TIER_RANK[existingCase.current_tier] >= TIER_RANK[TIER_1]) {
      return {
        tier: TIER_2,
        reason:
          `Severe chronic absence — ${absence_rate.toFixed(1)}% absence rate ` +
          `(≥20% threshold). Escalated intervention required per EC §60901.`,
      };
    }
    // No case yet — still creates at tier 1 first (below)
  }

  // ---- Chronic absent: tier 1 ----
  if (is_chronic_absent) {
    return {
      tier: TIER_1,
      reason:
        `Chronic absentee — ${absence_rate.toFixed(1)}% absence rate ` +
        `exceeds 10% threshold per EC §60901(c)(1)`,
    };
  }

  // Not chronically absent
  return { tier: TIER_NONE, reason: null };
}

/* ------------------------------------------------------------------ */
/* Core evaluation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Evaluates compliance for a single student against both the truancy
 * and chronic absence tracks. Returns the action the wrapper should
 * take (create, escalate, update, or none).
 *
 * **Rules:**
 * - Never create duplicate cases — if a case exists, evaluate for
 *   escalation or count updates only.
 * - Never de-escalate — a case at tier 3 stays at tier 3 even if
 *   attendance improves (must be manually resolved).
 * - Both tracks apply; the engine uses whichever produces the HIGHER tier.
 * - Specific, actionable reason strings with Ed Code citations.
 *
 * @param params - Student data, snapshot, existing case, today's date
 * @returns Action to take plus case data and escalation reason
 */
export function evaluateCompliance(params: ComplianceInput): ComplianceResult {
  const { studentId, schoolId, academicYear, snapshot, existingCase, today } =
    params;

  // ---- Insufficient data guard ----
  if (snapshot.days_enrolled < 10) {
    // Not enough school days to evaluate compliance
    return {
      student_id: studentId,
      school_id: schoolId,
      action: "none",
      case_data: null,
      escalation_reason: null,
      existing_case_id: existingCase?.id ?? null,
      escalation_blocked_reason: null,
    };
  }

  // ---- Evaluate both tracks ----
  const truancyResult = evaluateTruancyTrack(snapshot, existingCase, today);
  const chronicResult = evaluateChronicTrack(snapshot, existingCase);

  // Use whichever track produces the higher tier
  const determinedTier = higherTier(truancyResult.tier, chronicResult.tier);
  const primaryReason =
    (TIER_RANK[truancyResult.tier] ?? 0) >= (TIER_RANK[chronicResult.tier] ?? 0)
      ? truancyResult.reason
      : chronicResult.reason;

  // Combine reasons if both tracks triggered the same tier
  let combinedReason = primaryReason;
  if (
    truancyResult.tier !== TIER_NONE &&
    chronicResult.tier !== TIER_NONE &&
    truancyResult.reason &&
    chronicResult.reason &&
    truancyResult.tier === chronicResult.tier
  ) {
    combinedReason = `${truancyResult.reason}. Additionally: ${chronicResult.reason}`;
  }

  // ---- Build base case data ----
  const baseCaseData: CaseData = {
    student_id: studentId,
    school_id: schoolId,
    academic_year: academicYear,
    current_tier: determinedTier,
    reason: combinedReason ?? "",
    unexcused_count: snapshot.days_absent_unexcused,
    truancy_count: snapshot.truancy_count,
    total_absences: snapshot.total_absences,
    absence_rate: snapshot.absence_rate,
  };

  // ---- No case exists ----
  if (!existingCase) {
    if (determinedTier === TIER_NONE) {
      // Nothing to do
      return {
        student_id: studentId,
        school_id: schoolId,
        action: "none",
        case_data: null,
        escalation_reason: null,
        existing_case_id: null,
        escalation_blocked_reason: null,
      };
    }

    // Create a new case. The determined tier might be tier 1 or higher
    // (e.g., if student already has 6 truancy events when first evaluated).
    // However, per proper escalation, we start at tier 1 and let the next
    // run escalate. This ensures the notification letter goes out first.
    baseCaseData.current_tier = TIER_1;
    baseCaseData.tier_1_triggered_at = today;

    return {
      student_id: studentId,
      school_id: schoolId,
      action: "create_case",
      case_data: baseCaseData,
      escalation_reason: null,
      existing_case_id: null,
      escalation_blocked_reason: null,
    };
  }

  // ---- Case exists — evaluate for escalation ----

  const currentTierRank = TIER_RANK[existingCase.current_tier] ?? 0;
  const determinedTierRank = TIER_RANK[determinedTier] ?? 0;

  // Never de-escalate
  if (determinedTierRank <= currentTierRank) {
    // Update counts on existing case but don't change tier
    baseCaseData.current_tier = existingCase.current_tier;

    return {
      student_id: studentId,
      school_id: schoolId,
      action: "update_case",
      case_data: baseCaseData,
      escalation_reason: null,
      existing_case_id: existingCase.id,
      escalation_blocked_reason: null,
    };
  }

  // ---- Escalation ----
  // Only escalate one tier at a time to ensure each step is properly documented.
  const nextTierRank = currentTierRank + 1;
  let nextTier: string;
  let escalationTimestamp: Record<string, string> = {};

  if (nextTierRank === 1) {
    nextTier = TIER_1;
    escalationTimestamp = { tier_1_triggered_at: today };
  } else if (nextTierRank === 2) {
    nextTier = TIER_2;
    escalationTimestamp = { tier_2_triggered_at: today };
  } else {
    nextTier = TIER_3;
    escalationTimestamp = { tier_3_triggered_at: today };
  }

  // ---- Tier requirements gate ----
  // Before escalating, check that required documentation from the current
  // tier has been completed. This ensures the legal chain is never broken.
  const blockedReason = getEscalationBlockedReason(
    nextTier,
    existingCase.tier_requirements as Record<string, unknown> | undefined
  );

  if (blockedReason) {
    // Cannot escalate — tier requirements not met. Stay at current tier
    // and report the blocked reason so the wrapper can persist it.
    baseCaseData.current_tier = existingCase.current_tier;

    return {
      student_id: studentId,
      school_id: schoolId,
      action: "update_case",
      case_data: baseCaseData,
      escalation_reason: null,
      existing_case_id: existingCase.id,
      escalation_blocked_reason: blockedReason,
    };
  }

  baseCaseData.current_tier = nextTier;
  Object.assign(baseCaseData, escalationTimestamp);

  // Build escalation reason
  let escalationReason: string;
  if (nextTier === TIER_2) {
    escalationReason =
      combinedReason ??
      `Escalated to parent conference — ${snapshot.truancy_count} truancy events`;
  } else if (nextTier === TIER_3) {
    escalationReason =
      combinedReason ??
      `Escalated to SARB referral — ${snapshot.truancy_count} truancy events, ` +
        `${snapshot.absence_rate.toFixed(1)}% absence rate`;
  } else {
    escalationReason = combinedReason ?? "Escalated to notification letter";
  }

  return {
    student_id: studentId,
    school_id: schoolId,
    action: "escalate_case",
    case_data: baseCaseData,
    escalation_reason: escalationReason,
    existing_case_id: existingCase.id,
    escalation_blocked_reason: null,
  };
}
