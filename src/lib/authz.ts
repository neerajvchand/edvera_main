import { supabase } from "@/integrations/supabase/client";

/**
 * Check whether a user holds an active 'admin' membership for a given district.
 * Uses the security-definer RPC `has_membership_role` so RLS is bypassed safely.
 */
export async function isDistrictAdmin(
  userId: string,
  districtId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_membership_role", {
    _user_id: userId,
    _role: "admin",
    _district_id: districtId,
  });

  if (error) {
    console.error("isDistrictAdmin check failed:", error);
    return false;
  }

  return !!data;
}
