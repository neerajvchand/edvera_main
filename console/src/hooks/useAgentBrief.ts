import { useState, useEffect, useCallback } from "react";
import { getAgentBrief, type AgentBrief } from "@/services/agent/getAgentBrief";

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useAgentBrief(schoolId: string | null) {
  const [brief, setBrief] = useState<AgentBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrief = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getAgentBrief(schoolId);
      setBrief(data);
    } catch (err) {
      console.error("Agent brief error:", err);
      setError(err instanceof Error ? err.message : "Failed to load agent brief");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  return { brief, loading, error, refetch: fetchBrief };
}
