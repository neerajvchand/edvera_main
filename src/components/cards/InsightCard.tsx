import { useNavigate } from "react-router-dom";
import { useCurrentInsight } from "@/hooks/useCurrentInsight";
import { ChevronRight, Lightbulb, Info, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import type { InsightCategory, InsightSeverity, InsightPayload } from "@/types/insights";

const categoryColors: Record<InsightCategory, string> = {
  Attendance: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Academics: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Wellbeing: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Engagement: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Safety: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const severityBorder: Record<InsightSeverity, string> = {
  good: "border-l-emerald-400",
  neutral: "border-l-amber-400",
  concern: "border-l-rose-400",
};

/** Bullet comparison bar (primary vs comparison) */
function MiniBar({ primary, comp, primaryLabel, compLabel }: { primary: number; comp: number; primaryLabel?: string; compLabel?: string }) {
  const max = Math.max(primary, comp) * 1.2;
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 rounded-full bg-primary/80" style={{ width: `${(primary / max) * 100}%` }} />
          <span className="text-xs font-semibold text-foreground">{primary}%</span>
          {primaryLabel && <span className="text-[10px] text-muted-foreground">{primaryLabel}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 rounded-full bg-muted-foreground/30" style={{ width: `${(comp / max) * 100}%` }} />
          <span className="text-xs text-muted-foreground">{comp}%</span>
          {compLabel && <span className="text-[10px] text-muted-foreground">{compLabel}</span>}
        </div>
      </div>
    </div>
  );
}

/** Mini gauge arc */
function MiniGauge({ value, total }: { value: number; total: number }) {
  const pct = Math.min((value / total) * 100, 100);
  const angle = (pct / 100) * 180;
  return (
    <div className="flex items-center gap-3 my-2">
      <svg width="60" height="36" viewBox="0 0 60 36" className="shrink-0">
        <path d="M 5 32 A 25 25 0 0 1 55 32" fill="none" stroke="hsl(var(--border))" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M 5 32 A 25 25 0 0 1 55 32"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 78.5} 78.5`}
        />
      </svg>
      <span className="text-sm font-semibold text-foreground">{value}/{total} done</span>
    </div>
  );
}

export function InsightCard() {
  const navigate = useNavigate();
  const { data: insight, isLoading } = useCurrentInsight();
  const [showWhy, setShowWhy] = useState(false);

  if (isLoading) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.18s" }}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-5 bg-muted rounded w-full" />
          <div className="h-8 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!insight) return null;

  const p: InsightPayload = insight.payload ?? {};
  const updatedDate = new Date(insight.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Delta display
  const hasDelta = p.previous_year_value != null && p.current_year_value != null && p.delta_value != null;
  const deltaPositive = (p.delta_value ?? 0) > 0;

  // Determine mini viz content
  const renderMiniViz = () => {
    if (insight.mini_viz_type === "bullet" && p.primary_metric && p.comparison) {
      return <MiniBar primary={p.primary_metric.value} comp={p.comparison.value} primaryLabel="Your School" compLabel={p.comparison.label} />;
    }
    if (insight.mini_viz_type === "gauge" && p.checklist_items) {
      const done = p.checklist_items.filter((i) => i.status === "complete").length;
      return <MiniGauge value={done} total={p.checklist_items.length} />;
    }
    return null;
  };

  return (
    <div
      className={`pulse-card animate-fade-in border-l-4 ${severityBorder[insight.severity]} cursor-pointer`}
      style={{ animationDelay: "0.18s" }}
      onClick={() => navigate(`/insights/${insight.insight_id}`)}
      role="button"
      tabIndex={0}
      aria-label={`Insight: ${insight.headline}`}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/insights/${insight.insight_id}`)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Insight of the Week</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[insight.category]}`}>
          {insight.category}
        </span>
      </div>

      {/* Headline */}
      <h3 className="font-semibold text-foreground text-base leading-snug mb-0.5">
        {insight.headline}
      </h3>

      {/* Reporting year sub-label */}
      {p.reporting_year && (
        <p className="text-[11px] text-muted-foreground mb-1">
          School Year {p.reporting_year} ({insight.source})
        </p>
      )}

      {/* Delta display */}
      {hasDelta && (
        <div className="flex items-center gap-1.5 my-1.5">
          <span className="text-sm font-semibold text-foreground">
            {p.previous_year_value}% → {p.current_year_value}%
          </span>
          <span className={`text-xs flex items-center gap-0.5 ${deltaPositive ? "text-destructive" : "text-emerald-600"}`}>
            {deltaPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {deltaPositive ? "+" : ""}{p.delta_value} pp
          </span>
        </div>
      )}

      {/* Mini visualization */}
      {renderMiniViz()}

      {/* Context line */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
        {insight.context}
      </p>

      {/* CTA + Why */}
      <div className="flex items-center justify-between">
        <button
          className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          onClick={(e) => { e.stopPropagation(); navigate(`/insights/${insight.insight_id}`); }}
        >
          See details
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          onClick={(e) => { e.stopPropagation(); setShowWhy(!showWhy); }}
          aria-label="Why am I seeing this?"
        >
          <Info className="w-3.5 h-3.5" />
          Why this?
        </button>
      </div>

      {showWhy && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">{insight.why_this}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-border">
        <p className="text-[11px] text-muted-foreground/70">
          Source: {insight.source} • Updated {updatedDate}
        </p>
      </div>
    </div>
  );
}
