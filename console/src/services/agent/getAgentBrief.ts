/**
 * Agent brief service — fetches the daily brief via the agent-daily-brief
 * Edge Function (JWT + staff membership on the server, agent API key never
 * exposed to the browser).
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface BriefActionItem {
  priority: "urgent" | "elevated" | "routine";
  student_id: string;
  student_name: string;
  action_type: string;
  reason: string;
  ec_citation: string | null;
  case_id: string | null;
}

export interface BriefApprovalItem {
  item_type: string;
  case_id: string;
  student_name: string;
  submitted_by: string | null;
}

export interface BriefRiskSummary {
  at_risk_count: number;
  moderate_count: number;
  severe_count: number;
  new_truancy_threshold_crossings: number;
}

export interface BriefSummary {
  enrollment: number | null;
  absent_today: number | null;
  attendance_rate_30day: number | null;
  trend_direction: "declining" | "improving" | "stable";
  trend_delta: number;
}

export interface AgentBrief {
  brief_type: "school";
  generated_at: string;
  school_id: string;
  district_id: string;
  school_name: string;
  date: string;
  summary: BriefSummary;
  action_items: BriefActionItem[];
  requires_approval: BriefApprovalItem[];
  risk_summary: BriefRiskSummary;
  open_actions_count: number;
}

export interface AgentBriefResponse {
  success: boolean;
  data: AgentBrief;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch a daily brief for a school through the secure Edge proxy.
 * `district_id` is derived server-side from staff membership and the school record.
 */
export async function getAgentBrief(schoolId: string): Promise<AgentBrief> {
  try {
    const { data, error } = await supabase.functions.invoke<AgentBriefResponse>(
      "agent-daily-brief",
      { method: "POST", body: { school_id: schoolId } },
    );

    if (error) {
      throw error;
    }

    if (!data || typeof data !== "object") {
      throw new Error("Empty response from agent proxy");
    }

    if (!data.success) {
      throw new Error(data.error ?? "Agent returned unsuccessful response");
    }

    return data.data;
  } catch (err) {
    throw handleServiceError("fetch agent brief", err);
  }
}
