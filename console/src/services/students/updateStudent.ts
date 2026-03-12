import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

export interface StudentUpdate {
  first_name?: string;
  last_name?: string;
  grade_level?: string;
  gender?: string;
  birth_date?: string;
  language_fluency?: string;
  school_id?: string;
  is_active?: boolean;
}

/**
 * Update a student record by ID.
 * Returns the updated row.
 */
export async function updateStudent(
  studentId: string,
  updates: StudentUpdate
): Promise<{ id: string }> {
  try {
    const { data, error } = await supabase
      .from("students")
      .update(updates)
      .eq("id", studentId)
      .select("id")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    throw handleServiceError("update student", err);
  }
}
