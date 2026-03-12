import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { SchoolRecord } from "@/types/organization";

/**
 * Fetch all schools belonging to a district.
 * Results sorted by name.
 */
export async function getSchoolsByDistrict(
  districtId: string
): Promise<SchoolRecord[]> {
  try {
    const { data, error } = await supabase
      .from("schools")
      .select(
        "id, name, address, address_street, address_city, address_state, address_zip, phone, principal_name, district_id"
      )
      .eq("district_id", districtId)
      .order("name");

    if (error) throw error;
    return (data ?? []) as SchoolRecord[];
  } catch (err) {
    throw handleServiceError("load schools by district", err);
  }
}
