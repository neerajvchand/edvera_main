import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type CSVAction = "decision_assistant" | "board_brief" | "communication_draft";

export interface CSVAnalysisResult {
  data: any;
  action: CSVAction;
  loading: boolean;
  error: string | null;
}

export function useCSVAnalysis(documentId: string | null) {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runAction = useCallback(async (action: CSVAction, params?: Record<string, string>) => {
    if (!documentId) return;

    const key = params?.sub_action ? `${action}_${params.sub_action}` : action;
    setLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const { data, error } = await supabase.functions.invoke("csv-analysis", {
        body: { document_id: documentId, action, params },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setResults((prev) => ({ ...prev, [key]: data.data }));
      return data.data;
    } catch (e: any) {
      const msg = e?.message || "Analysis failed";
      toast({ title: "Analysis Error", description: msg, variant: "destructive" });
      setResults((prev) => ({ ...prev, [key]: null }));
      return null;
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, [documentId]);

  const getResult = useCallback((key: string) => results[key] ?? null, [results]);
  const isLoading = useCallback((key: string) => loading[key] ?? false, [loading]);

  return { runAction, getResult, isLoading };
}
