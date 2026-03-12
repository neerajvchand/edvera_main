import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";
import { InsightsPanel } from "@/components/InsightsPanel";
import { useDashboard, getAbsenceBand } from "@/hooks/useDashboard";
import { useSession } from "@/hooks/useSession";
import { useAgentBrief } from "@/hooks/useAgentBrief";
import { getStaffMembership } from "@/services/profiles/getStaffMembership";
import { getSchool } from "@/services/schools/getSchool";
import {
  getRecentActivity,
  type RecentActivityItem,
} from "@/services/actions/getRecentActivity";
import type {
  AgentBrief,
  BriefActionItem,
  BriefApprovalItem,
} from "@/services/agent/getAgentBrief";
import {
  Bot,
  RotateCcw,
  FileSignature,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  TrendingDown,
  TrendingUp,
  Minus,
  Shield,
  Mail,
  Phone,
  Users,
  FileText,
  ClipboardList,
} from "lucide-react";
export type { DashboardMetrics } from "@/hooks/useDashboard";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  urgent: { label: "Urgent", bg: "bg-red-50", text: "text-red-700" },
  elevated: { label: "Elevated", bg: "bg-amber-50", text: "text-amber-700" },
  routine: { label: "Routine", bg: "bg-slate-50", text: "text-slate-600" },
};

const ACTION_LABELS: Record<string, string> = {
  truancy_letter: "Send Truancy Letter",
  send_letter: "Send Notification Letter",
  send_truancy_letter: "Send Truancy Letter",
  counselor_referral: "Counselor Referral",
  conference: "Schedule Conference",
  schedule_conference: "Schedule Conference",
  parent_guardian_conference: "Parent Conference",
  sarb_referral: "SARB Referral",
  prepare_sarb_packet: "Prepare SARB Packet",
  follow_up_call: "Follow-up Call",
  followup_call: "Follow-up Call",
  monitor: "Monitor",
};

const ROLE_LABELS: Record<string, string> = {
  district_admin: "District Admin",
  principal: "Principal",
  attendance_clerk: "Attendance Clerk",
  counselor: "Counselor",
  staff: "Staff",
  teacher: "Teacher",
};

/**
 * Maps action types to the role typically responsible.
 * Used when the agent brief doesn't include role data.
 */
const ACTION_ROLE_MAP: Record<string, string> = {
  send_letter: "Attendance Clerk",
  send_truancy_letter: "Attendance Clerk",
  truancy_letter: "Attendance Clerk",
  follow_up_call: "Attendance Clerk",
  followup_call: "Attendance Clerk",
  schedule_conference: "Counselor",
  conference: "Counselor",
  parent_guardian_conference: "Counselor",
  counselor_referral: "Counselor",
  prepare_sarb_packet: "District Admin",
  sarb_referral: "District Admin",
  monitor: "Teacher",
};

const TREND_ICON: Record<string, typeof TrendingDown> = {
  declining: TrendingDown,
  improving: TrendingUp,
  stable: Minus,
};

const TREND_COLOR: Record<string, string> = {
  declining: "text-red-500",
  improving: "text-emerald-500",
  stable: "text-slate-400",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function actionIcon(type: string) {
  if (
    ["send_truancy_letter", "truancy_letter", "send_letter"].includes(type)
  )
    return Mail;
  if (
    ["followup_call", "follow_up_call"].includes(type)
  )
    return Phone;
  if (
    ["schedule_conference", "parent_guardian_conference", "conference"].includes(
      type,
    )
  )
    return Users;
  if (
    ["prepare_sarb_packet", "sarb_referral", "sarb_packet"].includes(type)
  )
    return FileText;
  return ClipboardList;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatRole(role: string | null): string {
  if (!role) return "Staff";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Metric Card                                                         */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  pill,
  tooltip,
}: {
  label: string;
  value: string;
  pill?: { label: string; bg: string; text: string };
  tooltip?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-[13px] font-medium text-gray-500 flex items-center">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </p>
      <p className="text-[28px] font-semibold text-gray-900 mt-1 leading-tight">
        {value}
      </p>
      {pill && (
        <span
          className={cn(
            "inline-block mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full",
            pill.bg,
            pill.text,
          )}
        >
          {pill.label}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* School Row                                                          */
/* ------------------------------------------------------------------ */

function SchoolRow({
  name,
  students,
  chronicRate,
  adaLoss,
  elevated,
}: {
  name: string;
  students: number;
  chronicRate: number;
  adaLoss: number;
  elevated: number;
}) {
  const band = getAbsenceBand(chronicRate);
  return (
    <tr className="hover:bg-emerald-50/50 transition-colors">
      <td className="py-3 px-4 text-sm font-medium text-gray-900">{name}</td>
      <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
        {students}
      </td>
      <td className="py-3 px-4">
        <span
          className={cn(
            "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full",
            band.pillBg,
            band.pillText,
          )}
        >
          {chronicRate.toFixed(1)}% &middot; {band.label}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
        ${adaLoss.toLocaleString()}
      </td>
      <td className="py-3 px-4 text-sm tabular-nums">
        {elevated > 0 ? (
          <span className="text-red-600 font-medium">{elevated}</span>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Action Item Row (with role + blocking reason)                       */
/* ------------------------------------------------------------------ */

function ActionItemRow({ item }: { item: BriefActionItem }) {
  const prio = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.routine;
  const Icon = actionIcon(item.action_type);
  const responsibleRole = ACTION_ROLE_MAP[item.action_type] ?? "Staff";

  // Determine blocking reasons for tier-gated actions
  const blockingReasons = getActionBlockingReasons(item);
  const isBlocked = blockingReasons.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg p-4",
        isBlocked ? "bg-amber-50/60 border border-amber-200" : "bg-slate-50",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 rounded-lg p-1.5 bg-white/60">
          <Icon
            className={cn(
              "h-4 w-4",
              isBlocked ? "text-gray-300" : "text-slate-500",
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0",
                prio.bg,
                prio.text,
              )}
            >
              {prio.label}
            </span>
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {responsibleRole}
            </span>
          </div>
          <p
            className={cn(
              "text-sm font-medium mt-1",
              isBlocked ? "text-gray-400" : "text-slate-900",
            )}
          >
            {ACTION_LABELS[item.action_type] ?? item.action_type}
            <span className="font-normal text-slate-500">
              {" "}
              &mdash; {item.student_name}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
          {item.ec_citation && (
            <p className="text-xs text-slate-400 mt-0.5">{item.ec_citation}</p>
          )}

          {/* Blocking reasons */}
          {isBlocked && (
            <div className="mt-2 space-y-0.5">
              <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                <Lock className="h-3 w-3 shrink-0" />
                Cannot complete &mdash; prerequisites not met:
              </p>
              {blockingReasons.map((reason, idx) => (
                <p key={idx} className="text-xs text-amber-600 ml-4">
                  &bull; {reason}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard-level blocking reasons for agent brief action items.
 * These mirror the workspace gate logic but work with BriefActionItem data.
 */
function getActionBlockingReasons(item: BriefActionItem): string[] {
  // Tier 3 actions are blocked when reason mentions prior tiers needed
  const TIER_3_TYPES = ["prepare_sarb_packet", "sarb_referral", "sarb_packet"];
  if (TIER_3_TYPES.includes(item.action_type)) {
    // The agent brief reason typically explains why this is needed,
    // but the blocking info comes from the ec_citation
    return [
      "Tier 1 notification and Tier 2 conference must be completed first",
      "Required by EC §48263 before SARB referral",
    ];
  }

  // Tier 2 actions may be blocked if reason indicates no prior letter
  const TIER_2_TYPES = [
    "follow_up_call",
    "followup_call",
    "schedule_conference",
    "conference",
    "parent_guardian_conference",
  ];
  if (
    TIER_2_TYPES.includes(item.action_type) &&
    item.reason?.toLowerCase().includes("notification not sent")
  ) {
    return ["Tier 1 notification letter must be sent first (EC §48260.5)"];
  }

  return [];
}

/* ------------------------------------------------------------------ */
/* Pending Signatures Panel (right column)                             */
/* ------------------------------------------------------------------ */

function PendingSignaturesPanel({
  approvalItems,
  loading,
}: {
  approvalItems: BriefApprovalItem[];
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-lg p-2 bg-purple-50">
          <FileSignature className="h-4 w-4 text-purple-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          Pending Signatures
        </h3>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2 mt-2" />
            </div>
          ))}
        </div>
      ) : approvalItems.length === 0 ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <p className="text-sm text-emerald-600 font-medium">
            No pending approvals
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvalItems.map((item) => (
            <div
              key={item.case_id}
              className="bg-amber-50 border border-amber-100 rounded-lg p-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={14}
                  className="text-amber-500 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {item.item_type === "sarb_packet_review"
                      ? "SARB Packet Review"
                      : item.item_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {item.student_name}
                  </p>
                  {item.submitted_by && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Submitted by {item.submitted_by}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recent Activity Panel (right column)                                */
/* ------------------------------------------------------------------ */

function RecentActivityPanel({
  activities,
  loading,
}: {
  activities: RecentActivityItem[];
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-lg p-2 bg-blue-50">
          <Activity className="h-4 w-4 text-blue-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          Recent Activity
        </h3>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-l-2 border-slate-200 pl-3 py-1">
              <div className="h-3 bg-slate-200 rounded w-full" />
              <div className="h-3 bg-slate-200 rounded w-2/3 mt-1" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">
          No recent activity in the last 7 days
        </p>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <div
              key={a.id}
              className="border-l-2 border-emerald-200 pl-3 py-1"
            >
              <p className="text-sm text-slate-700">
                <span className="font-medium">
                  {a.completed_by_name ?? "System"}
                </span>
                <span className="text-slate-400">
                  {" "}
                  ({formatRole(a.completed_by_role)})
                </span>
                <span className="text-slate-500">
                  {" "}
                  {a.status === "completed" ? "completed" : "deferred"}{" "}
                </span>
                <span className="font-medium">{a.title}</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {a.student_name} &middot; {a.school_name} &middot;{" "}
                {relativeTime(a.completed_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Risk Summary (compact inline version for main column)               */
/* ------------------------------------------------------------------ */

function RiskSummaryBar({ brief }: { brief: AgentBrief }) {
  const rs = brief.risk_summary;
  const TrendIcon = TREND_ICON[brief.summary.trend_direction] ?? Minus;
  const trendColor =
    TREND_COLOR[brief.summary.trend_direction] ?? "text-slate-400";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-amber-50 rounded-lg p-3 text-center">
        <p className="text-lg font-semibold text-amber-700">
          {rs.at_risk_count}
        </p>
        <p className="text-xs text-amber-600">At-Risk</p>
      </div>
      <div className="bg-orange-50 rounded-lg p-3 text-center">
        <p className="text-lg font-semibold text-orange-700">
          {rs.moderate_count}
        </p>
        <p className="text-xs text-orange-600">Moderate</p>
      </div>
      <div className="bg-red-50 rounded-lg p-3 text-center">
        <p className="text-lg font-semibold text-red-700">
          {rs.severe_count}
        </p>
        <p className="text-xs text-red-600">Severe</p>
      </div>
      <div className="bg-slate-50 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <TrendIcon size={16} className={trendColor} />
          <p className="text-lg font-semibold text-slate-700">
            {brief.summary.trend_direction}
          </p>
        </div>
        <p className="text-xs text-slate-500">Trend</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard Page                                                      */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const { metrics, loading } = useDashboard();
  const { user } = useSession();
  const [agentCtx, setAgentCtx] = useState<{
    schoolId: string | null;
    districtId: string | null;
  }>({ schoolId: null, districtId: null });

  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(
    [],
  );
  const [activityLoading, setActivityLoading] = useState(true);

  // Resolve agent context (school + district)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const membership = await getStaffMembership(user.id);
        if (!membership?.school_id) return;
        const school = await getSchool(membership.school_id);
        if (!school) return;
        setAgentCtx({
          schoolId: school.id,
          districtId: school.district_id,
        });
      } catch {
        // Agent panel is optional — silently skip
      }
    })();
  }, [user]);

  // Fetch recent activity
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const items = await getRecentActivity(10);
      setRecentActivity(items);
    } catch {
      // Non-critical — silently skip
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Agent brief
  const {
    brief,
    loading: briefLoading,
    refetch: refetchBrief,
  } = useAgentBrief(user?.id ?? null, agentCtx.districtId, agentCtx.schoolId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">
          Failed to load dashboard metrics.
        </p>
      </div>
    );
  }

  const band = getAbsenceBand(metrics.chronicAbsenceRate);

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {metrics.districtName} &middot; 2025-2026
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* ============ LEFT / MAIN COLUMN ============ */}
        <div className="flex-1 min-w-0">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <MetricCard
              label="Total Students"
              value={metrics.totalStudents.toLocaleString()}
              tooltip="Actively enrolled students across all schools in your district for the current school year."
            />
            <MetricCard
              label="Chronic Absence Rate"
              value={`${metrics.chronicAbsenceRate.toFixed(1)}%`}
              tooltip="Percentage of students absent 10% or more of their enrolled days, per CA Education Code §60901(c)(1). Includes all absence types — excused, unexcused, and suspensions."
              pill={{
                label: `${band.label} (${metrics.chronicAbsenceCount} students)`,
                bg: band.pillBg,
                text: band.pillText,
              }}
            />
            <MetricCard
              label="Projected ADA Loss"
              value={`$${metrics.projectedAdaLoss.toLocaleString()}`}
              tooltip="Estimated revenue loss from chronic absence. Calculated as: total absent days for chronically absent students × $65/day per-pupil ADA rate."
              pill={
                metrics.projectedAdaLoss > 50000
                  ? {
                      label: "Above threshold",
                      bg: "bg-red-50",
                      text: "text-red-700",
                    }
                  : undefined
              }
            />
            <MetricCard
              label="Students Needing Intervention"
              value={String(metrics.elevatedStudents)}
              tooltip="Students whose attendance trajectory is worsening."
              pill={
                metrics.softeningStudents > 0
                  ? {
                      label: `${metrics.softeningStudents} softening`,
                      bg: "bg-amber-50",
                      text: "text-amber-700",
                    }
                  : undefined
              }
            />
            <MetricCard
              label="Compliance Cases Open"
              value={String(metrics.complianceCasesOpen)}
              tooltip="Active truancy or chronic absence cases requiring action."
              pill={
                metrics.tier3Cases > 0
                  ? {
                      label: `${metrics.tier3Cases} SARB referrals`,
                      bg: "bg-red-50",
                      text: "text-red-700",
                    }
                  : undefined
              }
            />
            <MetricCard
              label="Elevated Risk Signals"
              value={String(metrics.elevatedStudents)}
              tooltip="Students flagged as 'elevated' by the risk engine — attendance declining rapidly."
              pill={{
                label: `${Math.round(
                  (metrics.elevatedStudents / metrics.totalStudents) * 100,
                )}% of students`,
                bg:
                  metrics.elevatedStudents / metrics.totalStudents > 0.2
                    ? "bg-red-50"
                    : "bg-amber-50",
                text:
                  metrics.elevatedStudents / metrics.totalStudents > 0.2
                    ? "text-red-700"
                    : "text-amber-700",
              }}
            />
          </div>

          {/* AI Insights */}
          <InsightsPanel metrics={metrics} />

          {/* Agent Brief — Risk + Action Items (inline) */}
          {(briefLoading || brief) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Bot size={20} className="text-emerald-500" />
                  <h2 className="text-lg font-semibold text-slate-900">
                    Agent Brief
                  </h2>
                  {brief && (
                    <span className="text-xs text-slate-400">
                      {brief.school_name}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => refetchBrief()}
                  disabled={briefLoading}
                  className={cn(
                    "flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 transition-colors",
                    briefLoading && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <RotateCcw
                    size={12}
                    className={briefLoading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>

              {briefLoading && (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-5 rounded bg-slate-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-slate-200 rounded w-3/4" />
                          <div className="h-3 bg-slate-200 rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!briefLoading && brief && (
                <>
                  {/* Risk summary */}
                  <RiskSummaryBar brief={brief} />

                  {/* Truancy threshold crossings */}
                  {brief.risk_summary.new_truancy_threshold_crossings > 0 && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 flex items-start gap-2">
                      <AlertTriangle
                        size={14}
                        className="text-red-500 mt-0.5 shrink-0"
                      />
                      <p className="text-sm text-red-700">
                        {brief.risk_summary.new_truancy_threshold_crossings}{" "}
                        student
                        {brief.risk_summary.new_truancy_threshold_crossings !== 1
                          ? "s"
                          : ""}{" "}
                        newly crossed the truancy threshold without a compliance
                        case.
                      </p>
                    </div>
                  )}

                  {/* Action items with role + blocking reasons */}
                  {brief.action_items.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                        Action Items ({brief.action_items.length})
                      </p>
                      <div className="space-y-2">
                        {brief.action_items.map((item, i) => (
                          <ActionItemRow
                            key={`${item.student_id}-${i}`}
                            item={item}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 bg-emerald-50 rounded-lg p-4 flex items-center gap-2">
                      <CheckCircle2
                        size={16}
                        className="text-emerald-500 shrink-0"
                      />
                      <p className="text-sm text-emerald-700">
                        No action items. All students are within expected
                        parameters.
                      </p>
                    </div>
                  )}

                  {/* Open actions count */}
                  {brief.open_actions_count > 0 && (
                    <p className="text-xs text-slate-400 mt-3">
                      {brief.open_actions_count} open action
                      {brief.open_actions_count !== 1 ? "s" : ""} across this
                      school
                    </p>
                  )}
                </>
              )}

              {/* Trust signal */}
              <div className="flex items-center gap-1.5 mt-4">
                <Shield size={14} className="text-slate-300 shrink-0" />
                <p className="text-xs text-slate-400">
                  Agent recommendations are advisory. All actions require staff
                  review before execution.
                </p>
              </div>
            </div>
          )}

          {/* School Breakdown Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-clip overflow-y-visible">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                School Breakdown
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center">
                      Chronic Absence
                      <InfoTooltip text="School-wide chronic absence rate and Attendance Works classification." />
                    </span>
                  </th>
                  <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center">
                      ADA Loss
                      <InfoTooltip text="Sum of projected ADA funding loss for all chronically absent students at this school." />
                    </span>
                  </th>
                  <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="inline-flex items-center">
                      Elevated
                      <InfoTooltip text="Number of students at this school with an 'elevated' risk signal." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.schoolBreakdown.map((s) => (
                  <SchoolRow key={s.name} {...s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div className="w-[340px] shrink-0 space-y-6 hidden lg:block">
          {/* Pending Signatures */}
          <PendingSignaturesPanel
            approvalItems={brief?.requires_approval ?? []}
            loading={briefLoading}
          />

          {/* Recent Activity */}
          <RecentActivityPanel
            activities={recentActivity}
            loading={activityLoading}
          />
        </div>
      </div>
    </div>
  );
}
