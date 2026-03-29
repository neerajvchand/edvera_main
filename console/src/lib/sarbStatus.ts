/**
 * Canonical SARB packet status constants.
 *
 * Single source of truth for the 5 valid sarb_packet_status values.
 * DB constraint: compliance_cases_sarb_packet_status_check
 * Last verified against: 20260316001_fix_sarb_status_constraint.sql
 */

export const SARB_STATUSES = [
  "not_started",
  "draft",
  "ready_for_approval",
  "approved",
  "submitted",
] as const;

export type SarbStatus = (typeof SARB_STATUSES)[number];

export const SARB_STATUS_CONFIG: Record<
  SarbStatus,
  { label: string; bg: string; text: string; description: string }
> = {
  not_started: {
    label: "Not Started",
    bg: "bg-gray-100",
    text: "text-gray-600",
    description: "SARB packet has not been initiated",
  },
  draft: {
    label: "Draft",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    description: "Packet is being assembled",
  },
  ready_for_approval: {
    label: "Awaiting Approval",
    bg: "bg-blue-50",
    text: "text-blue-700",
    description: "Submitted for principal review",
  },
  approved: {
    label: "Approved",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    description: "Principal has approved the packet",
  },
  submitted: {
    label: "Submitted to SARB",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    description: "Packet submitted to the SARB board",
  },
};
