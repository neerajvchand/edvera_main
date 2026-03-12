/**
 * Saves a SART meeting record to intervention_log
 * with intervention_type = 'sart_meeting'.
 */
import { supabase } from "@/lib/supabase";
import type { SartMeetingOutcome } from "@/types/caseWorkspace";

interface SartMeetingInput {
  meeting_date: string;
  attendees: string[];
  family_present: boolean;
  agenda_checklist: Record<string, boolean>;
  outcome: SartMeetingOutcome;
  notes: string;
}

export async function saveSartMeeting(
  caseId: string,
  studentId: string,
  schoolId: string,
  input: SartMeetingInput,
): Promise<{ success: boolean; error?: string }> {
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
    attendees: input.attendees,
    family_present: input.family_present,
    agenda_checklist: input.agenda_checklist,
  };

  const { error } = await supabase.from("intervention_log").insert({
    student_id: studentId,
    school_id: schoolId,
    compliance_case_id: caseId,
    intervention_type: "sart_meeting",
    intervention_date: input.meeting_date,
    description: input.notes || null,
    outcome: input.outcome,
    performed_by: user?.id ?? null,
    performed_by_name: performedByName,
    metadata,
  });

  if (error) {
    console.error("saveSartMeeting error:", error);
    return { success: false, error: "Failed to save SART meeting." };
  }

  return { success: true };
}
