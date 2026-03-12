import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AgentBriefPanel } from "@/components/dashboard/AgentBriefPanel";
import { useDashboard, getAbsenceBand } from "@/hooks/useDashboard";
import { useSession } from "@/hooks/useSession";
import { getStaffMembership } from "@/services/profiles/getStaffMembership";
import { getSchool } from "@/services/schools/getSchool";
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
/* Dashboard Page                                                      */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const { metrics, loading } = useDashboard();
  const { user } = useSession();
  const [agentCtx, setAgentCtx] = useState<{
    schoolId: string | null;
    districtId: string | null;
  }>({ schoolId: null, districtId: null });

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
          label="Elevated Risk Signals"
          value={String(metrics.elevatedStudents)}
          tooltip="Students flagged as 'elevated' by the risk engine — their recent attendance pattern indicates rapid decline and likely chronic absence if no intervention occurs."
          pill={{
            label: `${Math.round(
              (metrics.elevatedStudents / metrics.totalStudents) * 100
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

      {/* Agent Brief */}
      <AgentBriefPanel
        userId={user?.id ?? null}
        districtId={agentCtx.districtId}
        schoolId={agentCtx.schoolId}
      />

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
      </div>
    </div>
  );
}
