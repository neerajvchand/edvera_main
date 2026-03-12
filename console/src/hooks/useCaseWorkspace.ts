import { useState, useEffect, useCallback } from "react";
import { getCaseWorkspace } from "@/services/compliance/getCaseWorkspace";
import { useSession } from "@/hooks/useSession";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

export function useCaseWorkspace(caseId: string) {
  const { user } = useSession();
  const [data, setData] = useState<CaseWorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getCaseWorkspace(caseId, user.id);
      setData(result);
    } catch (e) {
      console.error("Failed to load case workspace:", e);
      setError("Failed to load case workspace");
    } finally {
      setIsLoading(false);
    }
  }, [caseId, user?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
