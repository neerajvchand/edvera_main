/**
 * Pure computation engine for student risk signal classification.
 *
 * Zero runtime dependencies — takes plain data in, returns plain results out.
 * All trajectory analysis and classification logic lives here so it can be
 * unit-tested without Supabase, Deno, or any other platform dependency.
 *
 * Risk signals evaluate a student's recent attendance trajectory (last 30 days
 * vs. prior 30 days) and classify them as stable, softening, or elevated.
 * This drives the early-warning system in the Edvera console.
 *
 * @module risk-engine
 */

/* ------------------------------------------------------------------ */
/* Input types                                                         */
/* ------------------------------------------------------------------ */

/**
 * The current attendance snapshot for a student (from attendance_snapshots).
 * This is the "overall" picture — full academic year to date.
 */
export interface SnapshotData {
  student_id: string;
  school_id: string;
  academic_year: string;
  days_enrolled: number;
  days_present: number;
  days_absent: number;
  attendance_rate: number; // percentage, e.g. 93.5
  is_chronic_absent: boolean;
}

/**
 * A window of attendance data for a specific date range (e.g., last 30 days).
 * Pre-computed by the wrapper from attendance_daily records.
 */
export interface AttendanceWindow {
  /** Number of instructional school days in the window. */
  days_enrolled: number;
  /** Number of days present (including tardy) in the window. */
  days_present: number;
  /** Number of days absent (all types) in the window. */
  days_absent: number;
  /** Number of consecutive absences at the END of the window (most recent streak). */
  consecutive_absences_tail: number;
}

/** Signal level enum values matching the PostgreSQL signal_level type. */
export type SignalLevel = "pending" | "stable" | "softening" | "elevated";

/** The existing risk signal for a student, if any. Used for anti-flicker logic. */
export interface ExistingSignal {
  signal_level: SignalLevel;
}

/** All inputs needed to compute a risk signal for one student. */
export interface RiskSignalInput {
  snapshot: SnapshotData;
  /** Attendance window for the last 30 calendar days (recent). */
  recentWindow: AttendanceWindow;
  /** Attendance window for days 31–60 ago (prior period for comparison). */
  priorWindow: AttendanceWindow;
  /** The student's current signal, if one exists. Null for first-time computation. */
  existingSignal: ExistingSignal | null;
  /** ISO date string — the "as of" date for this computation (usually today). */
  today: string;
}

/* ------------------------------------------------------------------ */
/* Output type                                                         */
/* ------------------------------------------------------------------ */

/** Computed risk signal result for a single student. */
export interface RiskSignalResult {
  student_id: string;
  school_id: string;

  /** The determined signal level. */
  signal_level: SignalLevel;
  /** Human-readable title explaining the signal (e.g., "Attendance declining"). */
  signal_title: string;
  /** Human-readable subtitle with specific numbers. */
  signal_subtitle: string | null;
  /** Recommended next step for staff. */
  next_step: string | null;

  /** Overall attendance rate from the snapshot (full academic year). */
  attendance_rate: number;
  /** Consecutive absences at the tail of the recent window. */
  consecutive_absences: number;
  /** Total instructional days enrolled (from snapshot). */
  total_days: number;
  /** Attendance rate for last 30 days. */
  last_30_rate: number;
  /** Attendance rate for prior 30 days (days 31–60). */
  previous_30_rate: number;
  /** Change in rate: last_30_rate - previous_30_rate. Negative = declining. */
  trend_delta: number;

  /** Simple linear projection of year-end attendance rate. */
  predicted_year_end_rate: number;
  /** Estimated probability (0–100) of meeting chronic absence threshold by year end. */
  predicted_chronic_risk_pct: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Minimum enrolled days in the recent window to perform trajectory analysis. */
const MIN_RECENT_DAYS = 5;

/** Minimum enrolled days in the prior window to perform comparison. */
const MIN_PRIOR_DAYS = 10;

/** Chronic absence threshold per CA Education Code §60901(c)(1). */
const CHRONIC_THRESHOLD = 10.0; // absence rate %

/**
 * Standard California school year length in instructional days.
 * Used for year-end projections.
 */
const SCHOOL_YEAR_DAYS = 180;

/* ------------------------------------------------------------------ */
/* Helper: compute window rate                                         */
/* ------------------------------------------------------------------ */

/**
 * Computes attendance rate for a window, guarding against division by zero.
 * Returns rate as a percentage rounded to 1 decimal place.
 */
function windowRate(window: AttendanceWindow): number {
  if (window.days_enrolled === 0) return 0;
  return Math.round((window.days_present / window.days_enrolled) * 1000) / 10;
}

/**
 * Computes absence rate for a window, guarding against division by zero.
 * Returns rate as a percentage rounded to 1 decimal place.
 */
function windowAbsenceRate(window: AttendanceWindow): number {
  if (window.days_enrolled === 0) return 0;
  return Math.round((window.days_absent / window.days_enrolled) * 1000) / 10;
}

/* ------------------------------------------------------------------ */
/* Helper: predict year-end rate                                       */
/* ------------------------------------------------------------------ */

/**
 * Projects the student's year-end attendance rate using a simple
 * weighted model: heavier weight on recent trajectory.
 *
 * - If we have both recent and prior windows, use a 70/30 blend
 *   (70% recent rate, 30% overall rate) projected across remaining days.
 * - If insufficient comparison data, use overall rate as projection.
 */
function predictYearEndRate(
  snapshot: SnapshotData,
  recentRate: number,
  hasComparison: boolean
): number {
  if (snapshot.days_enrolled === 0) return 0;

  const remainingDays = Math.max(0, SCHOOL_YEAR_DAYS - snapshot.days_enrolled);

  if (remainingDays === 0 || !hasComparison) {
    // No remaining days or insufficient data — use overall rate
    return snapshot.attendance_rate;
  }

  // Blend: 70% recent trajectory, 30% overall
  const projectedDailyRate = (recentRate * 0.7 + snapshot.attendance_rate * 0.3) / 100;
  const projectedFuturePresent = Math.round(remainingDays * projectedDailyRate);
  const totalPresent = snapshot.days_present + projectedFuturePresent;
  const totalEnrolled = snapshot.days_enrolled + remainingDays;

  return Math.round((totalPresent / totalEnrolled) * 1000) / 10;
}

/**
 * Estimates the probability (0–100) that a student will be chronically absent
 * by year end, based on current absence rate and recent trajectory.
 *
 * Uses a sigmoid-like mapping centered around the 10% chronic threshold:
 * - Well below 10% → low probability
 * - Near 10% → probability rises steeply
 * - Well above 10% → high probability
 * - Negative trend_delta increases risk
 */
function predictChronicRisk(
  snapshot: SnapshotData,
  recentAbsenceRate: number,
  trendDelta: number
): number {
  if (snapshot.days_enrolled === 0) return 0;

  // Current absence rate (from snapshot)
  const currentAbsenceRate =
    snapshot.days_enrolled > 0
      ? (snapshot.days_absent / snapshot.days_enrolled) * 100
      : 0;

  // Weighted absence rate: blend of overall and recent (favor recent)
  const blendedAbsenceRate = currentAbsenceRate * 0.4 + recentAbsenceRate * 0.6;

  // Distance from chronic threshold, adjusted by trajectory
  // Negative delta (declining attendance) pushes toward higher risk
  const trajectoryAdjustment = trendDelta < 0 ? Math.abs(trendDelta) * 0.3 : trendDelta * -0.1;
  const adjustedRate = blendedAbsenceRate + trajectoryAdjustment;

  // Sigmoid-like mapping: center at CHRONIC_THRESHOLD
  const distanceFromThreshold = adjustedRate - CHRONIC_THRESHOLD;

  // Use a logistic curve: 1 / (1 + e^(-k*x)) where k controls steepness
  const k = 0.5;
  const probability = 100 / (1 + Math.exp(-k * distanceFromThreshold));

  // Clamp to 0–100 and round to 1 decimal
  return Math.round(Math.max(0, Math.min(100, probability)) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Core classification                                                 */
/* ------------------------------------------------------------------ */

/**
 * Determines the raw signal level based on attendance trajectory.
 *
 * **Elevated** — immediate intervention warranted:
 * - Recent absence rate >= 20% (missing 1 in 5 days)
 * - Rate delta <= -10 (dramatic decline)
 * - Overall rate below 85% AND recent rate declining (rate_delta < 0)
 * - Student just crossed chronic threshold (is_chronic_absent AND wasn't before
 *   based on recent trajectory)
 *
 * **Softening** — attendance is slipping, watch closely:
 * - Rate delta <= -5 (moderate decline)
 * - Overall rate below 90% AND recent rate declining (rate_delta < 0)
 * - Student is "at risk" band (absence rate 6–10%) with downward trend
 *
 * **Stable** — none of the above conditions met.
 */
function classifyRaw(
  snapshot: SnapshotData,
  recentRate: number,
  priorRate: number,
  trendDelta: number,
  hasComparison: boolean
): { level: SignalLevel; reason: string; subtitle: string | null; nextStep: string | null } {
  const recentAbsenceRate = 100 - recentRate;

  // ---- ELEVATED checks ----

  // Check 1: Recent 30-day absence rate >= 20%
  if (recentAbsenceRate >= 20) {
    return {
      level: "elevated",
      reason: "Critical absence rate",
      subtitle: `${recentAbsenceRate.toFixed(1)}% absence rate in last 30 days (1 in ${Math.round(100 / recentAbsenceRate)} days missed)`,
      nextStep: "Schedule immediate family conference and review for SARB referral",
    };
  }

  // Check 2: Dramatic decline in attendance (delta <= -10)
  if (hasComparison && trendDelta <= -10) {
    return {
      level: "elevated",
      reason: "Attendance declining rapidly",
      subtitle: `Attendance dropped ${Math.abs(trendDelta).toFixed(1)}pp in 30 days (${priorRate.toFixed(1)}% → ${recentRate.toFixed(1)}%)`,
      nextStep: "Investigate root cause — check for recent family crisis or health issue",
    };
  }

  // Check 3: Overall rate below 85% AND still declining
  if (snapshot.attendance_rate < 85 && hasComparison && trendDelta < 0) {
    return {
      level: "elevated",
      reason: "Low attendance and still declining",
      subtitle: `${snapshot.attendance_rate.toFixed(1)}% overall with ${Math.abs(trendDelta).toFixed(1)}pp decline in recent 30 days`,
      nextStep: "Initiate intervention plan — student at high risk of chronic absence",
    };
  }

  // Check 4: Newly chronic (is_chronic AND recent trajectory shows crossing)
  if (snapshot.is_chronic_absent && hasComparison && priorRate >= 90 && recentRate < 90) {
    return {
      level: "elevated",
      reason: "Crossed chronic absence threshold",
      subtitle: `Now chronically absent at ${snapshot.attendance_rate.toFixed(1)}% — recent 30-day rate dropped to ${recentRate.toFixed(1)}%`,
      nextStep: "Document chronic absence status and begin tiered intervention",
    };
  }

  // ---- SOFTENING checks ----

  // Check 5: Moderate decline (delta <= -5)
  if (hasComparison && trendDelta <= -5) {
    return {
      level: "softening",
      reason: "Attendance trending down",
      subtitle: `Attendance dropped ${Math.abs(trendDelta).toFixed(1)}pp in 30 days (${priorRate.toFixed(1)}% → ${recentRate.toFixed(1)}%)`,
      nextStep: "Monitor closely — consider outreach to family",
    };
  }

  // Check 6: Below 90% overall AND recent decline
  if (snapshot.attendance_rate < 90 && hasComparison && trendDelta < 0) {
    return {
      level: "softening",
      reason: "Below 90% and still declining",
      subtitle: `${snapshot.attendance_rate.toFixed(1)}% overall attendance with ${Math.abs(trendDelta).toFixed(1)}pp recent decline`,
      nextStep: "Check in with student — early intervention can prevent chronic absence",
    };
  }

  // Check 7: At-risk band (absence rate 6–10%) with downward trend
  const overallAbsenceRate =
    snapshot.days_enrolled > 0
      ? (snapshot.days_absent / snapshot.days_enrolled) * 100
      : 0;
  if (overallAbsenceRate >= 6 && overallAbsenceRate < 10 && hasComparison && trendDelta < 0) {
    return {
      level: "softening",
      reason: "At-risk and trending toward chronic",
      subtitle: `${overallAbsenceRate.toFixed(1)}% absence rate, approaching chronic threshold (10%)`,
      nextStep: "Preventive outreach — student is at risk of becoming chronically absent",
    };
  }

  // ---- STABLE ----
  return {
    level: "stable",
    reason: "Attendance on track",
    subtitle: snapshot.days_enrolled > 0
      ? `${snapshot.attendance_rate.toFixed(1)}% attendance rate${hasComparison ? `, ${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(1)}pp trend` : ""}`
      : null,
    nextStep: null,
  };
}

/* ------------------------------------------------------------------ */
/* Anti-flicker logic                                                  */
/* ------------------------------------------------------------------ */

/**
 * Applies the anti-flicker rule: never downgrade from 'elevated' directly
 * to 'stable'. If the previous signal was 'elevated' and current classification
 * says 'stable', force to 'softening' instead.
 *
 * This prevents confusing status oscillations in the dashboard and ensures
 * that a student who was elevated gets at least one cycle of "softening"
 * before returning to stable — giving staff time to verify improvement.
 */
function applyAntiFlicker(
  rawLevel: SignalLevel,
  existing: ExistingSignal | null
): SignalLevel {
  if (!existing) return rawLevel;

  // Anti-flicker: elevated → stable gets dampened to softening
  if (existing.signal_level === "elevated" && rawLevel === "stable") {
    return "softening";
  }

  return rawLevel;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Computes a risk signal for a single student from their snapshot and
 * recent attendance windows.
 *
 * This is the core classification engine. It takes plain data objects
 * with zero runtime dependencies and produces a fully computed signal.
 *
 * **Edge cases**:
 * - If recentWindow has fewer than MIN_RECENT_DAYS (5) enrolled days,
 *   defaults to 'stable' with a note about insufficient data.
 * - If priorWindow has fewer than MIN_PRIOR_DAYS (10) enrolled days,
 *   skips trajectory comparison (no trend_delta calculations).
 * - If snapshot.days_enrolled = 0, returns 'pending'.
 *
 * @param params - Student snapshot, attendance windows, existing signal
 * @returns Fully computed risk signal with level, reason, metrics, and predictions
 */
export function computeRiskSignal(params: RiskSignalInput): RiskSignalResult {
  const { snapshot, recentWindow, priorWindow, existingSignal, today: _today } = params;

  // ---- Early exit: no enrollment data ----
  if (snapshot.days_enrolled === 0) {
    return {
      student_id: snapshot.student_id,
      school_id: snapshot.school_id,
      signal_level: "pending",
      signal_title: "Awaiting attendance data",
      signal_subtitle: "No instructional days recorded yet",
      next_step: null,
      attendance_rate: 0,
      consecutive_absences: 0,
      total_days: 0,
      last_30_rate: 0,
      previous_30_rate: 0,
      trend_delta: 0,
      predicted_year_end_rate: 0,
      predicted_chronic_risk_pct: 0,
    };
  }

  // ---- Compute window rates ----
  const recentRate = windowRate(recentWindow);
  const priorRate = windowRate(priorWindow);
  const recentAbsenceRate = windowAbsenceRate(recentWindow);

  // ---- Determine if we have enough data for comparison ----
  const hasRecentData = recentWindow.days_enrolled >= MIN_RECENT_DAYS;
  const hasComparison =
    hasRecentData && priorWindow.days_enrolled >= MIN_PRIOR_DAYS;

  const trendDelta = hasComparison ? Math.round((recentRate - priorRate) * 10) / 10 : 0;

  // ---- Insufficient recent data → default stable ----
  if (!hasRecentData) {
    const finalLevel = applyAntiFlicker("stable", existingSignal);
    return {
      student_id: snapshot.student_id,
      school_id: snapshot.school_id,
      signal_level: finalLevel,
      signal_title: "Insufficient recent data",
      signal_subtitle: `Only ${recentWindow.days_enrolled} instructional days in last 30 days — need ${MIN_RECENT_DAYS} for analysis`,
      next_step: null,
      attendance_rate: snapshot.attendance_rate,
      consecutive_absences: recentWindow.consecutive_absences_tail,
      total_days: snapshot.days_enrolled,
      last_30_rate: recentRate,
      previous_30_rate: priorRate,
      trend_delta: 0,
      predicted_year_end_rate: snapshot.attendance_rate,
      predicted_chronic_risk_pct: predictChronicRisk(snapshot, recentAbsenceRate, 0),
    };
  }

  // ---- Classify ----
  const classification = classifyRaw(
    snapshot,
    recentRate,
    priorRate,
    trendDelta,
    hasComparison
  );

  // ---- Apply anti-flicker ----
  const finalLevel = applyAntiFlicker(classification.level, existingSignal);

  // If anti-flicker changed the level, adjust the reason
  let finalTitle = classification.reason;
  let finalSubtitle = classification.subtitle;
  let finalNextStep = classification.nextStep;

  if (finalLevel !== classification.level) {
    // Was downgraded from elevated→stable, now forced to softening
    finalTitle = "Improving but still monitoring";
    finalSubtitle = `Previously elevated — ${classification.subtitle ?? `now at ${snapshot.attendance_rate.toFixed(1)}%`}`;
    finalNextStep = "Continue monitoring — verify sustained improvement before clearing";
  }

  // ---- Predictions ----
  const predictedYearEnd = predictYearEndRate(snapshot, recentRate, hasComparison);
  const chronicRisk = predictChronicRisk(snapshot, recentAbsenceRate, trendDelta);

  return {
    student_id: snapshot.student_id,
    school_id: snapshot.school_id,
    signal_level: finalLevel,
    signal_title: finalTitle,
    signal_subtitle: finalSubtitle,
    next_step: finalNextStep,
    attendance_rate: snapshot.attendance_rate,
    consecutive_absences: recentWindow.consecutive_absences_tail,
    total_days: snapshot.days_enrolled,
    last_30_rate: recentRate,
    previous_30_rate: priorRate,
    trend_delta: trendDelta,
    predicted_year_end_rate: predictedYearEnd,
    predicted_chronic_risk_pct: chronicRisk,
  };
}
