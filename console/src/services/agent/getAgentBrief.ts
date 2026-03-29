/**
 * Agent brief service — fetches the daily brief from the Python agent API.
 *
 * The agent API lives at VITE_AGENT_URL and requires VITE_AGENT_API_KEY.
 * Both are optional; if missing the service returns null so the UI
 * can gracefully hide the panel.
 */
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
/* Config                                                              */
/* ------------------------------------------------------------------ */

function getAgentConfig(): { url: string; apiKey: string } | null {
  const url = import.meta.env.VITE_AGENT_URL;
  const apiKey = import.meta.env.VITE_AGENT_API_KEY;
  if (!url || !apiKey) return null;
  return { url: url.replace(/\/+$/, ""), apiKey };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch a daily brief for a school from the agent API.
 * Returns null if the agent is not configured.
 */
export async function getAgentBrief(
  userId: string,
  districtId: string,
  schoolId: string,
): Promise<AgentBrief | null> {
  const config = getAgentConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}/agent/daily-brief`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({
        user_id: userId,
        district_id: districtId,
        school_id: schoolId,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Agent API ${res.status}: ${text}`);
    }

    const body: AgentBriefResponse = await res.json();

    if (!body.success) {
      throw new Error(body.error ?? "Agent returned unsuccessful response");
    }

    return body.data;
  } catch (err) {
    throw handleServiceError("fetch agent brief", err);
  }
}
