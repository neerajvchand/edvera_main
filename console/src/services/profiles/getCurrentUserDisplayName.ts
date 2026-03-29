/**
 * Get the current authenticated user's display name.
 *
 * Combines auth.getUser() + profiles lookup into a single service
 * call, avoiding direct supabase access in components.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getCurrentUserDisplayName(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    return profile?.display_name ?? null;
  } catch (err) {
    throw handleServiceError("get current user display name", err);
  }
}
