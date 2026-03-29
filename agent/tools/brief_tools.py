"""
Brief tools — orchestrate other tools into the daily brief output.
No LLM calls. Returns structured JSON matching AGENT_SPEC.md section 7.
"""

from __future__ import annotations

import datetime
import time
from typing import Optional

from agent.lib.supabase_client import get_supabase_client
from agent.lib.logging import log_tool_call
from agent.lib.tool_error import ToolError
from agent.tools.context_tools import get_school_context
from agent.tools.risk_tools import get_students_at_risk
from agent.tools.compliance_tools import get_open_actions
from agent.tools.intervention_tools import recommend_next_action


# ===================================================================
# PUBLIC TOOL FUNCTIONS
# ===================================================================

def generate_school_brief(
    school_id: str,
    district_id: str,
    user_id: str,
    date: Optional[str] = None,
) -> dict:
    """Orchestrate all tools into the daily school brief.

    This tool does NOT call the LLM.
    It computes the brief deterministically from tool outputs.
    """
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    if not date:
        date = datetime.date.today().isoformat()

    try:
        # 1. Get school context
        school = get_school_context(school_id, district_id)

        # 2. Get at-risk students
        at_risk = get_students_at_risk(
            district_id=district_id,
            school_id=school_id,
            risk_bands=["at-risk", "moderate", "severe"],
            include_truancy_threshold=True,
            limit=100,
            user_id=user_id,
        )

        # 3. Get recommendations for each at-risk student
        action_items: list[dict] = []
        for student in at_risk:
            rec = recommend_next_action(
                student_id=student["student_id"],
                district_id=district_id,
                user_id=user_id,
                case_id=student.get("active_case_id"),
            )
            if rec["action_type"] != "monitor":
                action_items.append({
                    "priority": rec["urgency"],
                    "student_id": student["student_id"],
                    "student_name": student["student_name"],
                    "action_type": rec["action_type"],
                    "reason": rec["rationale"],
                    "ec_citation": rec.get("ec_citation"),
                    "case_id": student.get("active_case_id"),
                })

        # 4. Sort by urgency
        urgency_order = {"urgent": 0, "elevated": 1, "routine": 2}
        action_items.sort(key=lambda x: urgency_order.get(x["priority"], 3))

        # 5. Get open actions
        open_actions = get_open_actions(
            district_id=district_id,
            school_id=school_id,
            user_id=user_id,
        )

        # 6. Get requires_approval items
        # Compliance cases with sarb_packet_status = 'ready_for_approval'
        approval_resp = (
            client.table("compliance_cases")
            .select("id, student_id, sarb_packet_status")
            .eq("school_id", school_id)
            .eq("sarb_packet_status", "ready_for_approval")
            .execute()
        )
        approval_cases = approval_resp.data or []

        requires_approval: list[dict] = []
        if approval_cases:
            # Fetch student names for approval cases
            approval_student_ids = list(set(
                c["student_id"] for c in approval_cases
            ))
            stu_resp = (
                client.table("students")
                .select("id, first_name, last_name")
                .in_("id", approval_student_ids)
                .execute()
            )
            stu_map = {
                s["id"]: "{} {}".format(
                    s.get("first_name", ""), s.get("last_name", "")
                )
                for s in (stu_resp.data or [])
            }

            for c in approval_cases:
                requires_approval.append({
                    "item_type": "sarb_packet_review",
                    "case_id": str(c["id"]),
                    "student_name": stu_map.get(c["student_id"], ""),
                    "submitted_by": None,  # would need join to profiles
                })

        # 7. Compute risk summary
        bands = [s["chronic_band"] for s in at_risk]

        # Trend — use school-level aggregate from at-risk students
        trend_rates = [
            (s.get("trend_delta", 0),)
            for s in at_risk
            if s.get("trend_delta") is not None
        ]

        avg_delta = (
            sum(t[0] for t in trend_rates) / len(trend_rates)
            if trend_rates else 0.0
        )

        trend_direction = "stable"
        if avg_delta < -0.005:
            trend_direction = "declining"
        elif avg_delta > 0.005:
            trend_direction = "improving"

        result = {
            "brief_type": "school",
            "generated_at": datetime.datetime.utcnow().isoformat(),
            "school_id": school_id,
            "district_id": district_id,
            "school_name": school.get("name", ""),
            "date": date,
            "summary": {
                "enrollment": None,  # Phase 2 — requires daily roster
                "absent_today": None,  # Phase 2 — requires daily feed
                "attendance_rate_30day": None,  # Phase 2
                "trend_direction": trend_direction,
                "trend_delta": round(avg_delta, 4),
            },
            "action_items": action_items,
            "requires_approval": requires_approval,
            "risk_summary": {
                "at_risk_count": bands.count("at-risk"),
                "moderate_count": bands.count("moderate"),
                "severe_count": bands.count("severe"),
                "new_truancy_threshold_crossings": len([
                    s for s in at_risk
                    if s.get("truancy_count", 0) >= 3
                    and not s.get("active_case_id")
                ]),
            },
            "open_actions_count": len(open_actions),
        }
        return result

    except ToolError:
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "generate_school_brief")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="generate_school_brief",
            inputs_summary={
                "school_id": school_id,
                "date": date,
            },
            output_summary="brief generated" if result else "null",
            latency_ms=latency,
            error=error_msg,
        )
