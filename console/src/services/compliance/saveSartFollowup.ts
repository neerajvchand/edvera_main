/**
 * Saves a SART 30-day follow-up record to intervention_log
 * with intervention_type = 'sart_followup'.
 */
import { supabase } from "@/lib/supabase";

interface SartFollowupInput {
  followup_date: string;
  attendance_improved: "yes" | "partial" | "no";
  action_items_completed: Record<string, boolean>;
  outcome: "closed" | "continue_monitoring" | "escalate_sarb";
  notes: string;
}

/**
 * Validates that followup_date is 25-35 days after the SART meeting date.
 */
function validateFollowupTiming(
  meetingDate: string,
  followupDate: string,
): string | null {
  const meeting = new Date(meetingDate);
  const followup = new Date(followupDate);
  const diffMs = followup.getTime() - meeting.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 25) {
    return `Follow-up date must be at least 25 days after the SART meeting (currently ${diffDays} days).`;
  }
  if (diffDays > 35) {
    return `Follow-up date must be within 35 days of the SART meeting (currently ${diffDays} days).`;
  }
  return null;
}

export async function saveSartFollowup(
  caseId: string,
  studentId: string,
  schoolId: string,
  sartMeetingDate: string,
  input: SartFollowupInput,
): Promise<{ success: boolean; error?: string }> {
  // Validate timing
  const timingError = validateFollowupTiming(
    sartMeetingDate,
    input.followup_date,
  );
  if (timingError) {
    return { success: false, error: timingError };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let performedByName = "Unknown";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();
    performedByName = profile?.display_name ?? user.email ?? "Unknown";
  }

  const metadata = {
    attendance_improved: input.attendance_improved,
    action_items_completed: input.action_items_completed,
  };

  const { error } = await supabase.from("intervention_log").insert({
    student_id: studentId,
    school_id: schoolId,
    compliance_case_id: caseId,
    intervention_type: "sart_followup",
    intervention_date: input.followup_date,
    description: input.notes || null,
    outcome: input.outcome,
    performed_by: user?.id ?? null,
    performed_by_name: performedByName,
    metadata,
  });

  if (error) {
    console.error("saveSartFollowup error:", error);
    return { success: false, error: "Failed to save SART follow-up." };
  }

  return { success: true };
}
