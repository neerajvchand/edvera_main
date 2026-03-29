/**
 * Auth service — wraps Supabase auth methods.
 *
 * Components and pages should import from here instead of
 * using supabase.auth directly.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Sign-in                                                             */
/* ------------------------------------------------------------------ */

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  } catch (err) {
    throw handleServiceError("sign in", err);
  }
}

/* ------------------------------------------------------------------ */
/* Sign-out                                                            */
/* ------------------------------------------------------------------ */

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    throw handleServiceError("sign out", err);
  }
}

/* ------------------------------------------------------------------ */
/* Get current user                                                    */
/* ------------------------------------------------------------------ */

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (err) {
    throw handleServiceError("get current user", err);
  }
}
