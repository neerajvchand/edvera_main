/**
 * Fetch the active staff membership for a user (authoritative for permissions).
 *
 * Returns the first active row with school and district context, or null.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface StaffMembershipRow {
  user_id: string;
  school_id: string;
  role: string;
  is_active: boolean;
  district_id: string;
}

type MembershipQueryRow = {
  user_id: string;
  school_id: string;
  role: string;
  is_active: boolean;
  schools:
    | { district_id: string }
    | { district_id: string }[]
    | null;
};

function districtIdFromJoin(schools: MembershipQueryRow["schools"]): string | null {
  if (!schools) return null;
  if (Array.isArray(schools)) {
    const d = schools[0]?.district_id;
    return d ?? null;
  }
  return schools.district_id ?? null;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getStaffMembership(
  userId: string,
): Promise<StaffMembershipRow | null> {
  try {
    const { data, error } = await supabase
      .from("staff_memberships")
      .select(
        "user_id, school_id, role, is_active, schools!inner(district_id)",
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as MembershipQueryRow;
    const districtId = districtIdFromJoin(row.schools);
    if (!districtId) return null;

    return {
      user_id: row.user_id,
      school_id: row.school_id,
      role: row.role,
      is_active: row.is_active,
      district_id: districtId,
    };
  } catch (err) {
    throw handleServiceError("load staff membership", err);
  }
}
