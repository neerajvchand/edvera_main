import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboard";
import type { BriefActionItem } from "@/services/agent/getAgentBrief";
import {
  CARD,
  SECTION_LABEL,
  TABLE_HEADER,
  ACTION_BTN,
  TIER_BADGE,
  STATUS_DOT,
  DEADLINE_COLOR,
  CASE_NAME,
  CASE_DETAIL,
} from "@/lib/designTokens";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CaseRow {
  id: string;
  studentName: string;
  schoolDetail: string;
  tier: number | null;
  nextAction: string;
  deadline: string;
  deadlineType: "urgent" | "warn" | "ok";
  ctaLabel: string;
  ctaLink: string;
}

interface NeedsAttentionQueueProps {
  metrics: DashboardMetrics;
  agentItems: BriefActionItem[];
  agentLoading: boolean;
  onSelect?: (row: CaseRow | null) => void;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const ACTION_LABELS: Record<string, string> = {
  truancy_letter: "Send Truancy Letter",
  counselor_referral: "Counselor Referral",
  conference: "Schedule Conference",
  sarb_referral: "SARB Referral",
  follow_up_call: "Follow-up Call",
  monitor: "Monitor",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function NeedsAttentionQueue({
  metrics,
  agentItems,
  agentLoading,
  onSelect,
}: NeedsAttentionQueueProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list: CaseRow[] = [];

    // --- Aggregate rows from metrics (always visible) ---
    if (metrics.actionsOverdue > 0) {
      list.push({
        id: "agg-overdue",
        studentName: `${metrics.actionsOverdue} overdue action${metrics.actionsOverdue !== 1 ? "s" : ""}`,
        schoolDetail: "Need attention today",
        tier: null,
        nextAction: "Review and complete overdue items",
        deadline: "Overdue now",
        deadlineType: "urgent",
        ctaLabel: "Review actions",
        ctaLink: "/actions",
      });
    }
    if (metrics.tier3Cases > 0) {
      list.push({
        id: "agg-sarb",
        studentName: `${metrics.tier3Cases} SARB referral${metrics.tier3Cases !== 1 ? "s" : ""}`,
        schoolDetail: "Tier 3 — SARB in progress",
        tier: 3,
        nextAction: "Review referral packets",
        deadline: "Action required",
        deadlineType: "urgent",
        ctaLabel: "View compliance",
        ctaLink: "/compliance",
      });
    }
    if (metrics.tier2Cases > 0) {
      list.push({
        id: "agg-tier2",
        studentName: `${metrics.tier2Cases} Tier 2 case${metrics.tier2Cases !== 1 ? "s" : ""}`,
        schoolDetail: "Parent conferences required",
        tier: 2,
        nextAction: "Schedule or complete conferences",
        deadline: "Follow up needed",
        deadlineType: "warn",
        ctaLabel: "View compliance",
        ctaLink: "/compliance",
      });
    }
    if (metrics.tier1Cases > 0) {
      list.push({
        id: "agg-tier1",
        studentName: `${metrics.tier1Cases} Tier 1 case${metrics.tier1Cases !== 1 ? "s" : ""}`,
        schoolDetail: "Truancy letters required",
        tier: 1,
        nextAction: "Generate and send Tier 1 letters",
        deadline: "In progress",
        deadlineType: "ok",
        ctaLabel: "View compliance",
        ctaLink: "/compliance",
      });
    }

    // --- Per-student rows from agent brief (if available) ---
    for (const item of agentItems) {
      const actionLabel = ACTION_LABELS[item.action_type] ?? item.action_type;
      const ecCite = item.ec_citation ? ` — ${item.ec_citation}` : "";

      list.push({
        id: `agent-${item.student_id}-${item.action_type}`,
        studentName: item.student_name,
        schoolDetail: item.reason ?? "",
        tier: null,
        nextAction: `${actionLabel}${ecCite}`,
        deadline: item.priority === "urgent" ? "Overdue" : "Pending",
        deadlineType:
          item.priority === "urgent"
            ? "urgent"
            : item.priority === "elevated"
              ? "warn"
              : "ok",
        ctaLabel: item.case_id ? "Open case" : "View student",
        ctaLink: item.case_id
          ? `/compliance/cases/${item.case_id}`
          : `/student/${item.student_id}`,
      });
    }

    // Sort: urgent first, warn second, ok last
    const order: Record<string, number> = { urgent: 0, warn: 1, ok: 2 };
    list.sort(
      (a, b) => (order[a.deadlineType] ?? 3) - (order[b.deadlineType] ?? 3),
    );

    return list;
  }, [metrics, agentItems]);

  const hasOverdue = metrics.actionsOverdue > 0;

  const handleRowClick = (row: CaseRow) => {
    const next = selectedId === row.id ? null : row.id;
    setSelectedId(next);
    onSelect?.(next ? row : null);
  };

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className={SECTION_LABEL}>
          Needs attention — active compliance cases
        </h2>
        {hasOverdue && (
          <span className="text-[11px] font-semibold text-red-500">
            {metrics.actionsOverdue} overdue
          </span>
        )}
      </div>

      {/* Column headers */}
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_70px_1fr_100px_120px] gap-2 px-4 mb-1.5">
          <span className={TABLE_HEADER}>Student</span>
          <span className={TABLE_HEADER}>Tier</span>
          <span className={TABLE_HEADER}>Next action</span>
          <span className={TABLE_HEADER}>Deadline</span>
          <span />
        </div>
      )}

      {/* Rows */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const isSelected = selectedId === row.id;
          return (
            <div
              key={row.id}
              onClick={() => handleRowClick(row)}
              className={cn(
                `${CARD} grid grid-cols-[1fr_70px_1fr_100px_120px] gap-2 items-center py-[14px] px-4 cursor-pointer transition-colors`,
                isSelected
                  ? "bg-blue-50 border-l-2 border-l-[#1c3f7a] rounded-l-none"
                  : "hover:bg-gray-50/60",
              )}
            >
              {/* Student */}
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      STATUS_DOT[row.deadlineType] ?? STATUS_DOT.ok,
                    )}
                  />
                  <span className={CASE_NAME}>{row.studentName}</span>
                </div>
                <p className={`${CASE_DETAIL} mt-0.5 pl-3.5 truncate`}>
                  {row.schoolDetail}
                </p>
              </div>

              {/* Tier */}
              <div>
                {row.tier ? (
                  <span className={cn(TIER_BADGE[row.tier] ?? TIER_BADGE[1])}>
                    Tier {row.tier}
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-300">—</span>
                )}
              </div>

              {/* Next action */}
              <span className="text-[12px] text-gray-500 truncate">
                {row.nextAction}
              </span>

              {/* Deadline */}
              <span
                className={cn(
                  "text-[12px]",
                  DEADLINE_COLOR[row.deadlineType] ?? DEADLINE_COLOR.ok,
                )}
              >
                {row.deadlineType === "urgent" && (
                  <AlertTriangle className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                )}
                {row.deadline}
              </span>

              {/* CTA */}
              <Link
                to={row.ctaLink}
                onClick={(e) => e.stopPropagation()}
                className={`${ACTION_BTN} text-center`}
              >
                {row.ctaLabel}
              </Link>
            </div>
          );
        })}

        {/* Empty state — only when truly no cases */}
        {rows.length === 0 && !agentLoading && (
          <div className={`${CARD} px-4 py-5 text-center`}>
            <p className={CASE_DETAIL}>
              No active compliance cases — all students on track.
            </p>
          </div>
        )}

        {/* Loading */}
        {agentLoading && rows.length === 0 && (
          <div className={`${CARD} px-4 py-5 text-center`}>
            <p className={CASE_DETAIL}>Loading case data...</p>
          </div>
        )}
      </div>
    </div>
  );
}
