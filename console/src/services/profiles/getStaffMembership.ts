/**
 * Fetch the active staff membership for a user.
 *
 * Returns the school_id of the user's active staff assignment,
 * or null if no active membership exists.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getStaffMembership(
  userId: string
): Promise<{ school_id: string } | null> {
  try {
    const { data } = await supabase
      .from("staff_memberships")
      .select("school_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    return data;
  } catch (err) {
    throw handleServiceError("load staff membership", err);
  }
}
