import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { DistrictRecord } from "@/types/organization";

/**
 * Fetch a single district by ID.
 */
export async function getDistrict(
  districtId: string
): Promise<DistrictRecord | null> {
  try {
    const { data, error } = await supabase
      .from("districts")
      .select("id, name, address, phone, superintendent_name, county_office_id, toolkit_url, toolkit_name")
      .eq("id", districtId)
      .single();

    if (error) throw error;
    return data as DistrictRecord;
  } catch (err) {
    throw handleServiceError("load district", err);
  }
}
