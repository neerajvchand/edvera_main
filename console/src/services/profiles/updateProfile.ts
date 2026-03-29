/**
 * Update a profile's display name.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function updateProfileDisplayName(
  profileId: string,
  displayName: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", profileId);

    if (error) throw error;
  } catch (err) {
    throw handleServiceError("update profile", err);
  }
}
