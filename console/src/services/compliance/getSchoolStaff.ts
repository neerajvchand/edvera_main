/**
 * Fetch school-level staff for case assignment.
 *
 * Uses two queries to avoid FK join issues between profiles and
 * staff_memberships (profiles.id ≠ user_id):
 *   1. Get user_ids + roles from staff_memberships for the school
 *   2. Get display_names from profiles where user_id IN (those ids)
 *
 * Deduplicates so each user appears once regardless of how many
 * school memberships they have.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

export interface StaffMember {
  userId: string;
  displayName: string;
  role: string;
}

const ASSIGNABLE_ROLES = [
  "attendance_clerk",
  "counselor",
  "principal",
  "district_admin",
];

/**
 * Returns staff members at a school who can be assigned as case owners.
 */
export async function getSchoolStaff(
  schoolId: string
): Promise<StaffMember[]> {
  try {
    // 1. Get active memberships for this school
    const { data: memberships, error: memErr } = await supabase
      .from("staff_memberships")
      .select("user_id, role")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in("role", ASSIGNABLE_ROLES);

    if (memErr) throw memErr;
    if (!memberships || memberships.length === 0) return [];

    // Deduplicate user_ids (a user may have multiple membership rows)
    const userMap = new Map<string, string>();
    for (const m of memberships) {
      // Keep first role encountered (highest-priority row)
      if (!userMap.has(m.user_id)) {
        userMap.set(m.user_id, m.role);
      }
    }

    const userIds = Array.from(userMap.keys());

    // 2. Get display names from profiles
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    if (profErr) throw profErr;

    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameMap.set(p.user_id as string, p.display_name as string);
    }

    // 3. Merge and return
    const result: StaffMember[] = [];
    for (const [userId, role] of userMap) {
      result.push({
        userId,
        displayName: nameMap.get(userId) ?? "Unknown",
        role,
      });
    }

    // Sort alphabetically by display name
    result.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return result;
  } catch (err) {
    throw handleServiceError("load school staff", err);
  }
}
