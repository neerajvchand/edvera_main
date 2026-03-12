/**
 * Fetch the primary contact for a student.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface StudentContact {
  firstName: string;
  lastName: string;
  address: string;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function getStudentPrimaryContact(
  studentId: string
): Promise<StudentContact | null> {
  try {
    const { data: contacts } = await supabase
      .from("contacts")
      .select(
        "first_name, last_name, address_street, address_city, address_state, address_zip"
      )
      .eq("student_id", studentId)
      .order("sequence_number", { ascending: true })
      .limit(1);

    if (!contacts || contacts.length === 0) return null;

    const c = contacts[0];
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    const addrParts = [
      c.address_street,
      c.address_city,
      c.address_state,
      c.address_zip,
    ].filter(Boolean);

    return {
      firstName: c.first_name ?? "",
      lastName: c.last_name ?? "",
      address: addrParts.join(", "),
    };
  } catch (err) {
    throw handleServiceError("load student contact", err);
  }
}
