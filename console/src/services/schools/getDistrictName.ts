import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/**
 * Fetch the name of the (single) district.
 *
 * The Edvera console is single-district. This helper queries
 * the `districts` table with a `.limit(1)` and returns the name
 * so no component or service needs to hard-code a district name.
 */
export async function getDistrictName(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("districts")
      .select("name")
      .limit(1)
      .single();

    if (error) throw error;
    return (data?.name as string) ?? "District";
  } catch (err) {
    throw handleServiceError("load district name", err);
  }
}
