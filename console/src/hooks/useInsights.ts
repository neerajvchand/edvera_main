import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { DashboardMetrics } from "@/hooks/useDashboard";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Insight {
  category: "declining" | "improving" | "warning" | "recommendation" | "funding";
  text: string;
  link?: string;
  priority: number;
}

interface CachedInsights {
  insights: Insight[];
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CACHE_KEY = "edvera_insights_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const INITIAL_SHOW = 4;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getAbsenceBandLabel(chronicRate: number): string {
  if (chronicRate < 5) return "Low";
  if (chronicRate < 10) return "Modest";
  if (chronicRate < 20) return "Significant";
  if (chronicRate < 30) return "High";
  return "Extreme";
}

export function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} min ago`;
  }
  const h = Math.floor(diff / 3600);
  return `${h}h ago`;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useInsights(metrics: DashboardMetrics | null) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const hasFetched = useRef(false);

  const generateInsights = useCallback(
    async (bypassCache = false) => {
      if (!metrics) return;

      // Check cache first
      if (!bypassCache) {
        try {
          const raw = sessionStorage.getItem(CACHE_KEY);
          if (raw) {
            const cached: CachedInsights = JSON.parse(raw);
            if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
              setInsights(cached.insights);
              setCacheTimestamp(cached.timestamp);
              setLoading(false);
              setError(null);
              return;
            }
          }
        } catch {
          /* corrupted cache, ignore */
        }
      }

      setLoading(true);
      setError(null);

      try {
        // Supplementary queries for data not in DashboardMetrics
        const [
          { count: stableCount },
          { count: tier1Count },
          { count: tier2Count },
          { count: overdueCount },
        ] = await Promise.all([
          supabase
            .from("risk_signals")
            .select("*", { count: "exact", head: true })
            .eq("signal_level", "stable"),
          supabase
            .from("compliance_cases")
            .select("*", { count: "exact", head: true })
            .eq("current_tier", "tier_1_letter")
            .eq("is_resolved", false),
          supabase
            .from("compliance_cases")
            .select("*", { count: "exact", head: true })
            .eq("current_tier", "tier_2_conference")
            .eq("is_resolved", false),
          supabase
            .from("actions")
            .select("*", { count: "exact", head: true })
            .eq("status", "open")
            .lt("due_date", new Date().toISOString().split("T")[0]),
        ]);

        const enrichedMetrics = {
          totalStudents: metrics.totalStudents,
          chronicAbsenceRate: metrics.chronicAbsenceRate,
          chronicAbsenceCount: metrics.chronicAbsenceCount,
          projectedAdaLoss: metrics.projectedAdaLoss,
          elevatedStudents: metrics.elevatedStudents,
          softeningStudents: metrics.softeningStudents,
          stableStudents: stableCount ?? 0,
          complianceCasesOpen: metrics.complianceCasesOpen,
          tier1Cases: tier1Count ?? 0,
          tier2Cases: tier2Count ?? 0,
          tier3Cases: metrics.tier3Cases,
          overdueActions: overdueCount ?? 0,
          schoolBreakdown: metrics.schoolBreakdown.map((s) => ({
            ...s,
            classification: getAbsenceBandLabel(s.chronicRate),
          })),
        };

        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-insights",
          { body: { metrics: enrichedMetrics } }
        );

        if (fnError) {
          let detail = fnError.message;
          try {
            const ctx = (fnError as { context?: Response }).context;
            if (ctx?.json) {
              const body = await ctx.json();
              detail = body?.error ?? detail;
            }
          } catch { /* context already consumed or unavailable */ }
          throw new Error(detail);
        }

        if (!data?.success) {
          throw new Error(data?.error ?? "Unknown error");
        }

        const parsed: Insight[] = (data.insights as Insight[])
          .filter(
            (i) =>
              i &&
              typeof i.category === "string" &&
              typeof i.text === "string" &&
              typeof i.priority === "number"
          )
          .sort((a, b) => a.priority - b.priority);

        const now = Date.now();
        setInsights(parsed);
        setCacheTimestamp(now);
        setLoading(false);

        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ insights: parsed, timestamp: now })
        );
      } catch (err) {
        console.error("InsightsPanel error:", err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setLoading(false);
      }
    },
    [metrics]
  );

  // Trigger on metrics load (once)
  useEffect(() => {
    if (metrics && !hasFetched.current) {
      hasFetched.current = true;
      generateInsights(false);
    }
  }, [metrics, generateInsights]);

  // Tick the relative timestamp every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const visibleInsights = expanded
    ? insights
    : insights.slice(0, INITIAL_SHOW);
  const hasMore = insights.length > INITIAL_SHOW;

  return {
    insights,
    visibleInsights,
    hasMore,
    loading,
    error,
    cacheTimestamp,
    expanded,
    setExpanded,
    generateInsights,
  };
}
