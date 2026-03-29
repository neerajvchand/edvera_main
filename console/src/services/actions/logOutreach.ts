/**
 * Log a family outreach attempt as a new action record.
 *
 * Creates a completed action row in the actions table so it
 * appears in the case timeline and action history.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

export interface OutreachInput {
  contactType: "phone" | "email" | "home_visit" | "in_person" | "letter";
  outcome:
    | "reached_positive"
    | "reached_no_resolution"
    | "left_voicemail"
    | "no_answer"
    | "wrong_number"
    | "email_sent"
    | "visit_completed"
    | "visit_no_answer";
  notes?: string;
  contactDate: string;
}

export async function logOutreach(
  caseId: string,
  studentId: string,
  schoolId: string,
  input: OutreachInput
): Promise<void> {
  try {
    // Snapshot current attendance rate for effectiveness tracking
    let attendanceRateBefore: number | null = null;
    if (studentId) {
      const { data: riskRow } = await supabase
        .from("risk_signals")
        .select("attendance_rate")
        .eq("student_id", studentId)
        .maybeSingle();
      if (riskRow?.attendance_rate != null) {
        attendanceRateBefore = parseFloat(riskRow.attendance_rate);
      }
    }

    const { error } = await supabase.from("actions").insert({
      compliance_case_id: caseId,
      student_id: studentId,
      school_id: schoolId,
      action_type: "follow_up_call",
      title: `Family contact — ${input.contactType.replace(/_/g, " ")}`,
      description: input.notes || null,
      status: "completed",
      priority: "medium",
      due_date: input.contactDate,
      completed_at: input.contactDate,
      completion_outcome: input.outcome,
      completion_notes: input.notes || null,
      completion_data: {
        contact_type: input.contactType,
        outcome: input.outcome,
        date_completed: input.contactDate,
        notes: input.notes || null,
      },
      ...(attendanceRateBefore !== null && {
        attendance_rate_before: attendanceRateBefore,
      }),
    });

    if (error) throw error;
  } catch (err) {
    throw handleServiceError("log outreach", err);
  }
}
