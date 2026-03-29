import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboard";
import { useInsights, relativeTime, type Insight } from "@/hooks/useInsights";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_CONFIG: Record<
  Insight["category"],
  { icon: typeof TrendingDown; color: string; bg: string }
> = {
  declining: { icon: TrendingDown, color: "text-red-500", bg: "bg-red-50" },
  improving: { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50" },
  recommendation: { icon: Lightbulb, color: "text-blue-500", bg: "bg-blue-50" },
  funding: { icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
};

const LINK_LABELS: Record<string, string> = {
  "/students": "View students",
  "/compliance": "Go to Compliance",
  "/actions": "Go to Actions",
  "/funding": "Go to Funding",
};

function getLinkLabel(link: string): string {
  if (link.startsWith("/student/")) return "View student";
  return LINK_LABELS[link] ?? "View details";
}

/* ------------------------------------------------------------------ */
/* Skeleton shimmer                                                    */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="bg-slate-50 rounded-lg p-4 mb-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-200 rounded w-full" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
        </div>
        <div className="h-3 bg-slate-200 rounded w-20 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Insight Card                                                        */
/* ------------------------------------------------------------------ */

function InsightCard({
  insight,
  onNavigate,
}: {
  insight: Insight;
  onNavigate: (path: string) => void;
}) {
  const config = CATEGORY_CONFIG[insight.category] ?? CATEGORY_CONFIG.warning;
  const Icon = config.icon;

  // Bold key numbers in the text
  const parts = insight.text.split(
    /(\$[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?%|\d+ students?|\d+ overdue|\d+ schools?)/g
  );

  return (
    <div className="bg-slate-50 rounded-lg p-4 mb-3 last:mb-0">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
            config.bg
          )}
        >
          <Icon size={16} className={config.color} />
        </div>
        <p className="flex-1 text-sm text-slate-700 leading-relaxed">
          {parts.map((part, i) =>
            /^\$[\d,]|^\d/.test(part) ? (
              <span key={i} className="font-semibold">
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>
        {insight.link && (
          <button
            onClick={() => onNavigate(insight.link!)}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex-shrink-0 mt-0.5 whitespace-nowrap"
          >
            {getLinkLabel(insight.link)} &rarr;
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function InsightsPanel({
  metrics,
}: {
  metrics: DashboardMetrics | null;
}) {
  const navigate = useNavigate();
  const ins = useInsights(metrics);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-emerald-500" />
          <h2 className="text-lg font-semibold text-slate-900">AI Insights</h2>
        </div>
        <div className="flex items-center gap-3">
          {ins.cacheTimestamp && !ins.loading && (
            <span className="text-xs text-slate-400">
              Updated {relativeTime(ins.cacheTimestamp)}
            </span>
          )}
          <button
            onClick={() => ins.generateInsights(true)}
            disabled={ins.loading}
            className={cn(
              "flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 transition-colors",
              ins.loading && "opacity-50 cursor-not-allowed"
            )}
          >
            <RotateCcw
              size={12}
              className={ins.loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading state */}
      {ins.loading && (
        <div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <p className="text-xs text-slate-400 italic mt-2">
            Analyzing attendance patterns...
          </p>
        </div>
      )}

      {/* Error / not-ready state — show a calm placeholder instead of raw error */}
      {!ins.loading && ins.error && (
        <div className="bg-slate-50 rounded-lg p-6 flex flex-col items-center text-center">
          <Sparkles size={24} className="text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">
            AI insights will appear here after sufficient attendance data has
            been collected.
          </p>
        </div>
      )}

      {/* Insight cards */}
      {!ins.loading && !ins.error && ins.insights.length > 0 && (
        <div>
          {ins.visibleInsights.map((insight, i) => (
            <InsightCard
              key={`${insight.category}-${i}`}
              insight={insight}
              onNavigate={(path) => navigate(path)}
            />
          ))}

          {ins.hasMore && (
            <button
              onClick={() => ins.setExpanded(!ins.expanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-2 mx-auto"
            >
              {ins.expanded ? (
                <>
                  <ChevronUp size={14} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Show{" "}
                  {ins.insights.length - 4} more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!ins.loading && !ins.error && ins.insights.length === 0 && (
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-500">
            No insights available yet. Click Refresh to generate.
          </p>
        </div>
      )}

      {/* Trust signal */}
      <div className="flex items-center gap-1.5 mt-4">
        <Shield size={14} className="text-slate-300 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Insights are generated from aggregate metrics only. No student names or IDs leave your database.
        </p>
      </div>
    </div>
  );
}
