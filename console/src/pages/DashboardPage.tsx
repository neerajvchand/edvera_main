import { useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { useMembership } from "@/context/MembershipContext";
import { usePermission } from "@/hooks/usePermission";
import { useAgentBrief } from "@/hooks/useAgentBrief";
import {
  NeedsAttentionQueue,
  type CaseRow,
} from "@/components/dashboard/NeedsAttentionQueue";
import { WorkflowStepper } from "@/components/dashboard/WorkflowStepper";
import { BottomPanels, type AuditEntry } from "@/components/dashboard/BottomPanels";
import {
  CARD,
  METRIC_LABEL,
  METRIC_VALUE,
  CASE_DETAIL,
  CONTENT_PADDING,
  METRIC_VALUE_COLORS,
} from "@/lib/designTokens";

export type { DashboardMetrics } from "@/hooks/useDashboard";

/* ------------------------------------------------------------------ */
/* Metric Card                                                         */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div className={`${CARD} p-5`}>
      <p className={`${METRIC_LABEL} mb-1`}>{label}</p>
      <p
        className={METRIC_VALUE}
        style={{ color: valueColor ?? METRIC_VALUE_COLORS.default }}
      >
        {value}
      </p>
      <p className={`${CASE_DETAIL} mt-0.5`}>{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className={`${CONTENT_PADDING} animate-pulse`}>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${CARD} p-5`}>
            <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-7 w-16 bg-gray-200 rounded mb-1" />
            <div className="h-2.5 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      <div className="h-3 w-64 bg-gray-200 rounded mb-2" />
      {[1, 2, 3].map((i) => (
        <div key={i} className={`${CARD} h-16 mb-1.5`} />
      ))}
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
  const { brief, loading: briefLoading } = useAgentBrief(schoolId);
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);

  if (loading) return <DashboardSkeleton />;

  if (!metrics) {
    return (
      <div className={CONTENT_PADDING}>
        <p className="text-xs text-gray-500">
          Failed to load dashboard metrics.
        </p>
      </div>
    );
  }

  const showAgent = can("dashboard", "agent");

  // Build audit trail from agent brief data or placeholder
  const auditTrail: AuditEntry[] = [];
  const agentItems = showAgent ? (brief?.action_items ?? []) : [];
  if (agentItems.length > 0) {
    for (const item of agentItems.slice(0, 3)) {
      const actionLabel =
        item.action_type === "truancy_letter"
          ? "Tier 1 letter generated"
          : item.action_type === "conference"
            ? "SART conference logged"
            : item.action_type === "sarb_referral"
              ? "SARB packet submitted"
              : "Action logged";
      auditTrail.push({
        text: `${actionLabel} — ${item.student_name}`,
        time: "Recent",
      });
    }
  }

  return (
    <div className={CONTENT_PADDING}>
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MetricCard
          label="Total Students"
          value={metrics.totalStudents.toLocaleString()}
          sub={`Across ${metrics.schoolBreakdown.length} school${metrics.schoolBreakdown.length !== 1 ? "s" : ""}`}
          valueColor={METRIC_VALUE_COLORS.navy}
        />
        <MetricCard
          label="Chronic Rate"
          value={`${metrics.chronicAbsenceRate.toFixed(1)}%`}
          sub="At-risk threshold"
          valueColor={METRIC_VALUE_COLORS.amber}
        />
        <MetricCard
          label="Overdue Actions"
          value={String(metrics.actionsOverdue)}
          sub="Need attention today"
          valueColor={
            metrics.actionsOverdue > 0
              ? METRIC_VALUE_COLORS.red
              : METRIC_VALUE_COLORS.default
          }
        />
        <MetricCard
          label="Projected ADA Loss"
          value={`$${metrics.projectedAdaLoss.toLocaleString()}`}
          sub="2025–26 fiscal year"
          valueColor={METRIC_VALUE_COLORS.navy}
        />
      </div>

      {/* Active cases table */}
      <NeedsAttentionQueue
        metrics={metrics}
        agentItems={agentItems}
        agentLoading={showAgent && briefLoading}
        onSelect={setSelectedCase}
      />

      {/* Workflow stepper — conditional on selection */}
      <WorkflowStepper selectedCase={selectedCase} />

      {/* Bottom panels — flush against stepper */}
      <div className="mt-4">
        <BottomPanels
          schools={metrics.schoolBreakdown}
          complianceCasesOpen={metrics.complianceCasesOpen}
          auditTrail={auditTrail}
        />
      </div>
    </div>
  );
}
