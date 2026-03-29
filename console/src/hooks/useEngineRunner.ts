import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EngineResults {
  snapshots: { processed: number; chronic_count: number; error_count: number };
  risk_signals: {
    processed: number;
    elevated: number;
    softening: number;
    stable: number;
    error_count: number;
  };
  compliance: {
    processed: number;
    new_cases: number;
    escalations: number;
    error_count: number;
  };
  actions: {
    new_actions: number;
    error_count: number;
  };
  total_elapsed_seconds: number;
}

/**
 * Hook that runs the full engine pipeline (snapshots → risk signals →
 * compliance → actions) by calling the run-all-engines Edge Function.
 *
 * This avoids importing Deno-specific pure functions into the browser.
 * The Edge Function uses the service role key internally, so we invoke
 * it through the Supabase client's functions.invoke() method.
 */
export function useEngineRunner() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<EngineResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAllEngines = useCallback(async (): Promise<EngineResults | null> => {
    setRunning(true);
    setError(null);
    setResults(null);

    try {
      setProgress("Computing snapshots...");

      // Short delay so the UI can render the first progress message
      await new Promise((r) => setTimeout(r, 100));

      setProgress("Running all engines (snapshots → risk signals → compliance → actions)...");

      const { data, error: fnError } = await supabase.functions.invoke(
        "run-all-engines",
        { method: "POST" }
      );

      if (fnError) {
        throw new Error(fnError.message ?? "Engine invocation failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const engineResults: EngineResults = {
        snapshots: data.snapshots ?? {
          processed: 0,
          chronic_count: 0,
          error_count: 0,
        },
        risk_signals: data.risk_signals ?? {
          processed: 0,
          elevated: 0,
          softening: 0,
          stable: 0,
          error_count: 0,
        },
        compliance: data.compliance ?? {
          processed: 0,
          new_cases: 0,
          escalations: 0,
          error_count: 0,
        },
        actions: data.actions ?? {
          new_actions: 0,
          error_count: 0,
        },
        total_elapsed_seconds: data.total_elapsed_seconds ?? 0,
      };

      setResults(engineResults);
      setProgress("Complete!");
      return engineResults;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown engine error";
      setError(msg);
      setProgress("");
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  return { running, progress, results, error, runAllEngines };
}
