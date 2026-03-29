/**
 * Four-layer case stage constants.
 *
 * Single source of truth for all valid stage values across the four
 * dimensions of a compliance case's lifecycle.
 *
 * DB constraint source: 20260316002_four_layer_state_model.sql
 * Last verified: 2026-03-16
 */

/* ------------------------------------------------------------------ */
/* Layer 1 — Risk Stage (attendance reality, system-driven)            */
/* ------------------------------------------------------------------ */

export const RISK_STAGES = [
  'monitoring',
  'early_concern',
  'tier_2_support',
  'tier_3_intensive',
  'sarb_candidate',
  'post_sarb_followup',
] as const;

export type RiskStage = (typeof RISK_STAGES)[number];

/* ------------------------------------------------------------------ */
/* Layer 2 — Case Workflow Stage (staff operations, human-driven)       */
/* ------------------------------------------------------------------ */

export const CASE_WORKFLOW_STAGES = [
  'new',
  'needs_review',
  'outreach_in_progress',
  'barrier_assessment',
  'intervention_active',
  'compliance_prep',
  'ready_for_board',
  'monitoring_period',
  'closed',
] as const;

export type CaseWorkflowStage = (typeof CASE_WORKFLOW_STAGES)[number];

export const CASE_WORKFLOW_STAGE_CONFIG: Record<
  CaseWorkflowStage,
  { label: string; description: string; bg: string; text: string }
> = {
  new: {
    label: 'New',
    description: 'Case opened, awaiting initial review',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  },
  needs_review: {
    label: 'Needs Review',
    description: 'Data confirmed, needs owner assignment',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  outreach_in_progress: {
    label: 'Outreach',
    description: 'Active family contact and outreach',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  barrier_assessment: {
    label: 'Barrier Assessment',
    description: 'Documenting root cause factors',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  intervention_active: {
    label: 'Intervention Active',
    description: 'Interventions underway, monitoring progress',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  compliance_prep: {
    label: 'Compliance Prep',
    description: 'Preparing documentation for SARB referral',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  ready_for_board: {
    label: 'Ready for Board',
    description: 'Packet submitted, awaiting SARB hearing',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
  monitoring_period: {
    label: 'Monitoring',
    description: 'Attendance improved — monitoring for 30-60 days before resolution',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  closed: {
    label: 'Closed',
    description: 'Case resolved or dismissed',
    bg: 'bg-gray-100',
    text: 'text-gray-500',
  },
};

/* ------------------------------------------------------------------ */
/* Layer 3 — Packet Stage (document/artifact lifecycle)                */
/* ------------------------------------------------------------------ */

export const PACKET_STAGES = [
  'not_started',
  'draft',
  'generated',
  'under_review',
  'approved',
  'submitted',
] as const;

export type PacketStage = (typeof PACKET_STAGES)[number];

export const PACKET_STAGE_CONFIG: Record<
  PacketStage,
  { label: string; bg: string; text: string; iconName: string }
> = {
  not_started: {
    label: 'Not Started',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    iconName: 'circle',
  },
  draft: {
    label: 'Draft',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    iconName: 'clock',
  },
  generated: {
    label: 'Generated',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    iconName: 'file-check',
  },
  under_review: {
    label: 'Awaiting Approval',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    iconName: 'shield',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    iconName: 'check-circle-2',
  },
  submitted: {
    label: 'Submitted to SARB',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    iconName: 'check-circle-2',
  },
};

/* ------------------------------------------------------------------ */
/* Layer 4 — Outcome Stage (result after hearing)                      */
/* ------------------------------------------------------------------ */

export const OUTCOME_STAGES = [
  'pending',
  'hearing_scheduled',
  'agreement_reached',
  'returned_to_tier_2',
  'resolved',
  'referred_out',
] as const;

export type OutcomeStage = (typeof OUTCOME_STAGES)[number];

export const OUTCOME_STAGE_CONFIG: Record<
  OutcomeStage,
  { label: string; bg: string; text: string }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  },
  hearing_scheduled: {
    label: 'Hearing Scheduled',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  agreement_reached: {
    label: 'Agreement Reached',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  returned_to_tier_2: {
    label: 'Returned to Tier 2',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
  },
  referred_out: {
    label: 'Referred Out',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
};
