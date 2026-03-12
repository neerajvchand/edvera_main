import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import type { CountyOfficeRecord } from "@/types/organization";

/**
 * Fetch a single county office by ID.
 * RLS is read-only for all authenticated users.
 */
export async function getCountyOffice(
  countyOfficeId: string
): Promise<CountyOfficeRecord | null> {
  try {
    const { data, error } = await supabase
      .from("county_offices")
      .select(
        "id, name, short_name, sarb_coordinator_name, sarb_coordinator_email, sarb_coordinator_phone, sarb_meeting_location, sarb_meeting_schedule, sarb_referral_instructions"
      )
      .eq("id", countyOfficeId)
      .single();

    if (error) throw error;
    return data as CountyOfficeRecord;
  } catch (err) {
    throw handleServiceError("load county office", err);
  }
}
