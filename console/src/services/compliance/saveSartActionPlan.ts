/**
 * Saves SART action plan items into the actions table
 * with action_type = 'sart_action'.
 */
import { supabase } from "@/lib/supabase";

interface SartActionInput {
  description: string;
  assigned_role: string;
  due_date: string;
}

export async function saveSartActionPlan(
  caseId: string,
  studentId: string,
  schoolId: string,
  items: SartActionInput[],
): Promise<{ success: boolean; error?: string }> {
  if (items.length === 0) {
    return { success: false, error: "At least one action item is required." };
  }
  if (items.length > 5) {
    return { success: false, error: "Maximum 5 action items allowed." };
  }

  const rows = items.map((item) => ({
    student_id: studentId,
    school_id: schoolId,
    compliance_case_id: caseId,
    action_type: "sart_action",
    title: item.description,
    description: `Assigned to: ${item.assigned_role}`,
    reason: "SART action plan",
    priority: "normal",
    status: "open",
    due_date: item.due_date,
  }));

  const { error } = await supabase.from("actions").insert(rows);

  if (error) {
    console.error("saveSartActionPlan error:", error);
    return { success: false, error: "Failed to save SART action plan." };
  }

  return { success: true };
}
