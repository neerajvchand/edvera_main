import { cn } from "@/lib/utils";
import {
  Bot,
  RotateCcw,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { useAgentBrief } from "@/hooks/useAgentBrief";
import type { AgentBrief, BriefActionItem } from "@/services/agent/getAgentBrief";

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
  counselor_referral: "Counselor Referral",
  conference: "Schedule Conference",
  sarb_referral: "SARB Referral",
  follow_up_call: "Follow-up Call",
  monitor: "Monitor",
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
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function SkeletonRows() {
  return (
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
  );
}

/* ------------------------------------------------------------------ */
/* Action Item Row                                                     */
/* ------------------------------------------------------------------ */

function ActionItemRow({ item }: { item: BriefActionItem }) {
  const prio = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.routine;

  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full mt-0.5 flex-shrink-0",
            prio.bg,
            prio.text
          )}
        >
          {prio.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">
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
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Risk Summary                                                        */
/* ------------------------------------------------------------------ */

function RiskSummary({ brief }: { brief: AgentBrief }) {
  const rs = brief.risk_summary;
  const TrendIcon = TREND_ICON[brief.summary.trend_direction] ?? Minus;
  const trendColor = TREND_COLOR[brief.summary.trend_direction] ?? "text-slate-400";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <div className="bg-amber-50 rounded-lg p-3 text-center">
        <p className="text-lg font-semibold text-amber-700">{rs.at_risk_count}</p>
        <p className="text-xs text-amber-600">At-Risk</p>
      </div>
      <div className="bg-orange-50 rounded-lg p-3 text-center">
        <p className="text-lg font-semibold text-orange-700">{rs.moderate_count}</p>
        <p className="text-xs text-orange-600">Moderate</p>
      </div>
      <div className="bg-red-50 rounded-lg p-3 text-center">
        <p className="text-lg font-semibold text-red-700">{rs.severe_count}</p>
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
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function AgentBriefPanel({ schoolId }: { schoolId: string | null }) {
  const { brief, loading, error, refetch } = useAgentBrief(schoolId);
  const [expanded, setExpanded] = useState(false);

  // Don't render if agent is not configured (brief is null, no error, not loading)
  if (!loading && !error && !brief) return null;

  const COLLAPSED_LIMIT = 3;
  const actionItems = brief?.action_items ?? [];
  const visibleItems = expanded
    ? actionItems
    : actionItems.slice(0, COLLAPSED_LIMIT);
  const hasMore = actionItems.length > COLLAPSED_LIMIT;

  return (
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
          onClick={() => refetch()}
          disabled={loading}
          className={cn(
            "flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 transition-colors",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          <RotateCcw
            size={12}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Loading state */}
      {loading && <SkeletonRows />}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-slate-500">
                Unable to load agent brief. Dashboard data is unaffected.
              </p>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brief content */}
      {!loading && !error && brief && (
        <>
          {/* Risk summary */}
          <RiskSummary brief={brief} />

          {/* Approval items */}
          {brief.requires_approval.length > 0 && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {brief.requires_approval.length} item{brief.requires_approval.length !== 1 ? "s" : ""} awaiting approval
                  </p>
                  {brief.requires_approval.map((a) => (
                    <p key={a.case_id} className="text-xs text-amber-700 mt-0.5">
                      SARB packet review &mdash; {a.student_name}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action items */}
          {actionItems.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                Action Items ({actionItems.length})
              </p>
              <div className="space-y-2">
                {visibleItems.map((item, i) => (
                  <ActionItemRow key={`${item.student_id}-${i}`} item={item} />
                ))}
              </div>

              {hasMore && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-3 mx-auto"
                >
                  {expanded ? (
                    <>
                      <ChevronUp size={14} /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Show{" "}
                      {actionItems.length - COLLAPSED_LIMIT} more
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-lg p-4 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700">
                No action items. All students are within expected parameters.
              </p>
            </div>
          )}

          {/* Open actions count */}
          {brief.open_actions_count > 0 && (
            <p className="text-xs text-slate-400 mt-3">
              {brief.open_actions_count} open action{brief.open_actions_count !== 1 ? "s" : ""} across this school
            </p>
          )}

          {/* New threshold crossings */}
          {brief.risk_summary.new_truancy_threshold_crossings > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">
                {brief.risk_summary.new_truancy_threshold_crossings} student{brief.risk_summary.new_truancy_threshold_crossings !== 1 ? "s" : ""} newly
                crossed the truancy threshold without a compliance case.
              </p>
            </div>
          )}
        </>
      )}

      {/* Trust signal */}
      <div className="flex items-center gap-1.5 mt-4">
        <Shield size={14} className="text-slate-300 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Agent recommendations are advisory. All actions require staff review before execution.
        </p>
      </div>
    </div>
  );
}
