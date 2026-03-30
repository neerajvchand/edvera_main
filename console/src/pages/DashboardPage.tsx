import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AgentBriefPanel } from "@/components/dashboard/AgentBriefPanel";
import { useDashboard, getAbsenceBand } from "@/hooks/useDashboard";
import type { DashboardMetrics } from "@/hooks/useDashboard";
import { useMembership } from "@/context/MembershipContext";
import { usePermission } from "@/hooks/usePermission";
import {
  AlertTriangle,
  ClipboardList,
  Eye,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
export type { DashboardMetrics } from "@/hooks/useDashboard";

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
            pill.text
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
            band.pillText
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
/* Priority Briefing Card                                              */
/* ------------------------------------------------------------------ */

function PriorityBriefingCard({ metrics }: { metrics: DashboardMetrics }) {
  const items: { icon: React.ReactNode; text: string; link: string; urgent: boolean }[] = [];

  if (metrics.actionsOverdue > 0) {
    items.push({
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      text: `${metrics.actionsOverdue} overdue action${metrics.actionsOverdue > 1 ? "s" : ""} need attention`,
      link: "/actions",
      urgent: true,
    });
  }

  if (metrics.advisoryCount > 0) {
    items.push({
      icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
      text: `${metrics.advisoryCount} case advisor${metrics.advisoryCount > 1 ? "ies" : "y"} to review (improvements, stale cases, plateaus)`,
      link: "/actions",
      urgent: false,
    });
  }

  if (metrics.monitoringCases > 0) {
    items.push({
      icon: <Eye className="h-4 w-4 text-emerald-500" />,
      text: `${metrics.monitoringCases} case${metrics.monitoringCases > 1 ? "s" : ""} in monitoring period`,
      link: "/compliance",
      urgent: false,
    });
  }

  if (metrics.tier3Cases > 0) {
    items.push({
      icon: <ClipboardList className="h-4 w-4 text-red-500" />,
      text: `${metrics.tier3Cases} SARB referral${metrics.tier3Cases > 1 ? "s" : ""} in progress`,
      link: "/compliance",
      urgent: false,
    });
  }

  // Show tier breakdown if cases exist
  if (metrics.tier1Cases > 0 || metrics.tier2Cases > 0) {
    const parts: string[] = [];
    if (metrics.tier1Cases > 0) parts.push(`${metrics.tier1Cases} Tier 1`);
    if (metrics.tier2Cases > 0) parts.push(`${metrics.tier2Cases} Tier 2`);
    items.push({
      icon: <ClipboardList className="h-4 w-4 text-amber-500" />,
      text: `${parts.join(", ")} compliance case${(metrics.tier1Cases + metrics.tier2Cases) > 1 ? "s" : ""} active`,
      link: "/compliance",
      urgent: false,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-8">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">
          Today&apos;s Priorities
        </h2>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((item, i) => (
          <Link
            key={i}
            to={item.link}
            className={cn(
              "flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group",
              item.urgent && "bg-red-50/50"
            )}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span className={cn("text-sm", item.urgent ? "font-medium text-gray-900" : "text-gray-700")}>
                {item.text}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard Page                                                      */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const { metrics, loading } = useDashboard();
  const { schoolId } = useMembership();
  const { can } = usePermission();

  if (loading) {
    return (
      <div className="p-8 max-w-6xl">
        <div className="mb-8">
          <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-56 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse"
            >
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-7 w-16 bg-gray-200 rounded mt-2" />
              <div className="h-5 w-28 bg-gray-100 rounded-full mt-3" />
            </div>
          ))}
        </div>
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
    <div className="p-8 max-w-6xl">
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
          tooltip="Percentage of students absent 10% or more of their enrolled days, per CA Education Code §60901(c)(1). Includes all absence types — excused, unexcused, and suspensions. Bands: Satisfactory (0–5.9%), At-Risk (6–9.9%), Moderate (10–19.9%), Severe (20–49.9%), Acute (50%+)."
          pill={{
            label: `${band.label} (${metrics.chronicAbsenceCount} students)`,
            bg: band.pillBg,
            text: band.pillText,
          }}
        />
        <MetricCard
          label="Projected ADA Loss"
          value={`$${metrics.projectedAdaLoss.toLocaleString()}`}
          tooltip="Estimated revenue loss from chronic absence. Calculated as: total absent days for chronically absent students × $65/day per-pupil ADA rate. Each day a student misses school, the district loses that day's Average Daily Attendance funding."
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
          tooltip="Students whose attendance trajectory is worsening. 'Softening' means their attendance rate is declining over the past 30 days. 'Elevated' means they've crossed into a higher-risk attendance band."
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
          tooltip="Active truancy or chronic absence cases requiring action. Cases progress through tiers: Tier 1 (notification letter per EC §48260.5), Tier 2 (parent conference per EC §48262), Tier 3 (SARB referral per EC §48263)."
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
          label="Actions Due"
          value={String(metrics.actionsOpen)}
          tooltip="Open action items generated by the compliance engine. Includes tier-based actions (send letter, schedule conference, prepare SARB packet) and health advisories (improvement detected, stale cases, plateaus)."
          pill={
            metrics.actionsOverdue > 0
              ? {
                  label: `${metrics.actionsOverdue} overdue`,
                  bg: "bg-red-50",
                  text: "text-red-700",
                }
              : metrics.advisoryCount > 0
                ? {
                    label: `${metrics.advisoryCount} advisories`,
                    bg: "bg-blue-50",
                    text: "text-blue-700",
                  }
                : undefined
          }
        />
      </div>

      {/* Today's Priorities */}
      <PriorityBriefingCard metrics={metrics} />

      {/* AI Insights */}
      <InsightsPanel metrics={metrics} />

      {/* Agent Brief */}
      {can("dashboard", "agent") && (
        <AgentBriefPanel schoolId={schoolId} />
      )}

      {/* School Breakdown Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-clip overflow-y-visible">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            School Breakdown
          </h2>
        </div>
        {metrics.schoolBreakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-500">
              No school data available yet. Import attendance data to see a
              breakdown by school.
            </p>
          </div>
        ) : (
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
                    <InfoTooltip text="School-wide chronic absence rate and Attendance Works classification. Low (<5%), Modest (5–9.9%), Significant (10–19.9%), High (20–29.9%), Extreme (30%+)." />
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
                    <InfoTooltip text="Number of students at this school with an 'elevated' risk signal — attendance declining rapidly." />
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
        )}
      </div>
    </div>
  );
}
