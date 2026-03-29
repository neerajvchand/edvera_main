import { useState } from "react";
import {
  completeAction,
  type ActionCompletionData,
} from "@/services/actions/completeAction";

export function useCompleteAction(
  caseId: string,
  onSuccess: () => void
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = async (
    actionId: string,
    completionData: ActionCompletionData
  ) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await completeAction(actionId, caseId, completionData);
      if (result.success) {
        onSuccess(); // triggers workspace refetch
      } else {
        setError(result.error ?? "Failed to complete action");
      }
    } catch {
      setError("Unexpected error completing action");
    } finally {
      setIsSubmitting(false);
    }
  };

  return { complete, isSubmitting, error };
}
