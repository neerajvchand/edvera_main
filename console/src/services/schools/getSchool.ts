import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { SchoolRecord } from "@/types/organization";

/**
 * Fetch a single school by ID.
 * Returns all fields needed by the case workspace and document generation.
 */
export async function getSchool(
  schoolId: string
): Promise<SchoolRecord | null> {
  try {
    const { data, error } = await supabase
      .from("schools")
      .select(
        "id, name, address, address_street, address_city, address_state, address_zip, phone, principal_name, district_id"
      )
      .eq("id", schoolId)
      .single();

    if (error) throw error;
    return data as SchoolRecord;
  } catch (err) {
    throw handleServiceError("load school", err);
  }
}
