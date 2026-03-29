import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FlaggedStudent {
  firstName: string;
  lastName: string;
  reason: "overdue_action" | "elevated_risk" | string;
  detail: string;
}

export interface MetricsSnapshot {
  schoolName: string;
  totalStudents: number;
  chronicCount: number;
  chronicRate: number;
  elevatedCount: number;
  softeningCount: number;
  stableCount: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  overdueCount: number;
  oldestOverdueDays: number;
  projectedLoss: number;
  dayNumber: number;
  totalDays: number;
}

export interface Brief {
  id: string;
  school_id: string;
  brief_date: string;
  narrative: string;
  metrics_snapshot: MetricsSnapshot;
  students_flagged: FlaggedStudent[];
  generated_at: string;
  run_id: string | null;
}

export interface AgentRun {
  id: string;
  status: "running" | "completed" | "failed";
  schools_processed: number;
  briefs_sent: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useBriefs() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [{ data: briefData, error: briefErr }, { data: runData }] =
        await Promise.all([
          supabase
            .from("briefs")
            .select("*")
            .order("brief_date", { ascending: false })
            .order("generated_at", { ascending: false })
            .limit(20),
          supabase
            .from("agent_runs")
            .select(
              "id, status, schools_processed, briefs_sent, started_at, completed_at, error_message"
            )
            .eq("run_type", "daily_brief")
            .order("started_at", { ascending: false })
            .limit(5),
        ]);

      if (briefErr) {
        console.error("Failed to fetch briefs:", briefErr);
      } else {
        setBriefs((briefData as Brief[]) ?? []);
      }

      setRuns((runData as AgentRun[]) ?? []);
    } catch (err) {
      console.error("BriefsPanel fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = useCallback(async () => {
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "daily-brief"
      );

      if (fnError) {
        let detail = fnError.message;
        try {
          const ctx = (fnError as { context?: Response }).context;
          if (ctx?.json) {
            const body = await ctx.json();
            detail = body?.error ?? detail;
          }
        } catch {
          /* context already consumed */
        }
        throw new Error(detail);
      }

      if (!data?.success) {
        throw new Error(data?.error ?? "Unknown error");
      }

      setSuccess(
        `${data.briefs_generated} brief${data.briefs_generated !== 1 ? "s" : ""} generated for ${data.schools_processed} school${data.schools_processed !== 1 ? "s" : ""}.`
      );

      await fetchData();
    } catch (err) {
      console.error("Generate briefs error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate briefs"
      );
    } finally {
      setSending(false);
    }
  }, [fetchData]);

  // Group briefs by date
  const briefsByDate = briefs.reduce<Record<string, Brief[]>>((acc, b) => {
    const key = b.brief_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  const dates = Object.keys(briefsByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );
  const latestDate = dates[0] ?? null;
  const latestBriefs = latestDate ? briefsByDate[latestDate] : [];
  const olderDates = dates.slice(1);

  return {
    loading,
    sending,
    error,
    success,
    briefs,
    runs,
    showHistory,
    setShowHistory,
    handleGenerate,
    briefsByDate,
    latestDate,
    latestBriefs,
    olderDates,
  };
}
