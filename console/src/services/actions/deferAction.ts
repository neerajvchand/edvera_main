import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/**
 * Defer an action to a later date with a reason.
 * Returns the updated action's id.
 */
export async function deferAction(
  actionId: string,
  deferUntil: string,
  reason: string
): Promise<{ id: string }> {
  try {
    const { data, error } = await supabase
      .from("actions")
      .update({
        status: "deferred",
        due_date: deferUntil,
        completion_notes: reason,
        completion_outcome: "deferred",
      })
      .eq("id", actionId)
      .select("id")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw handleServiceError("defer action", err);
  }
}
