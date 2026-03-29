/**
 * Fetch a user's profile by their auth user_id.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ProfileRecord {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getProfile(
  userId: string
): Promise<ProfileRecord | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, display_name, role")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw handleServiceError("load profile", err);
  }
}
