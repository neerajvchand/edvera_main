"""
Intervention tools — history and next-action recommendation.
All read-only. All district-scoped.
"""

from __future__ import annotations

import os
import time
import datetime
from typing import Optional

from agent.lib.supabase_client import get_supabase_client
from agent.lib.logging import log_tool_call
from agent.lib.tool_error import ToolError, DistrictBoundaryViolation
from agent.tools.risk_tools import _rate_to_decimal
from agent.tools.compliance_tools import _parse_tier_requirements


# ---------------------------------------------------------------------------
# Compliance ladder — pure Python, no LLM
# ---------------------------------------------------------------------------

def _apply_compliance_ladder(
    unexcused_absences: int,
    truancy_count: int,
    attendance_rate: float,
    tier1_complete: bool,
    tier2_complete: bool,
    sarb_eligible: bool,
    active_case: bool,
) -> tuple:
    """Apply the EC compliance ladder deterministically.

    Returns (action_type, urgency, ec_citation).
    The LLM does not override this logic — it uses the output
    to construct the recommendation narrative.
    """
    if attendance_rate < 0.80:
        return ("counselor_referral", "urgent", None)

    if not active_case and unexcused_absences >= 3:
        return ("truancy_letter", "urgent", "EC §48260")

    if active_case and tier1_complete and not tier2_complete:
        return ("conference", "elevated", "EC §48262")

    if active_case and sarb_eligible and not tier2_complete:
        # Should not happen but guard against it
        return ("conference", "urgent", "EC §48262")

    if active_case and tier1_complete and tier2_complete and sarb_eligible:
        return ("sarb_referral", "urgent", "EC §48263")

    if active_case and tier1_complete and tier2_complete and not sarb_eligible:
        return ("follow_up_call", "routine", None)

    return ("monitor", "routine", None)


# ===================================================================
# PUBLIC TOOL FUNCTIONS
# ===================================================================


# ---------------------------------------------------------------------------
# get_intervention_history
# ---------------------------------------------------------------------------

def get_intervention_history(
    student_id: str,
    district_id: str,
    user_id: str = "",
    limit: int = 20,
) -> list[dict]:
    """All interventions logged for a student."""
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[list] = None

    try:
        # District validation
        student_resp = (
            client.table("students")
            .select("id, district_id")
            .eq("id", student_id)
            .execute()
        )
        if not student_resp.data:
            raise ToolError("Student not found.", "get_intervention_history")
        if student_resp.data[0].get("district_id") != district_id:
            raise DistrictBoundaryViolation("get_intervention_history")

        # Intervention log — actual columns: intervention_type, intervention_date,
        # description, outcome, performed_by, performed_by_name
        il_resp = (
            client.table("intervention_log")
            .select(
                "id, intervention_type, intervention_date, "
                "description, outcome, "
                "performed_by, performed_by_name"
            )
            .eq("student_id", student_id)
            .order("intervention_date", desc=True)
            .limit(limit)
            .execute()
        )

        result = []
        for row in (il_resp.data or []):
            # Use performed_by_name if available; otherwise look up profile
            logged_by = row.get("performed_by_name")
            result.append({
                "intervention_id": str(row["id"]),
                "intervention_type": row.get("intervention_type", ""),
                "date": str(row.get("intervention_date", "")),
                "description": row.get("description"),
                "outcome": row.get("outcome"),
                "logged_by": logged_by,
            })

        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_intervention_history")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="get_intervention_history",
            inputs_summary={
                "student_id": student_id,
                "limit": limit,
            },
            output_summary="{} interventions".format(len(result) if result else 0),
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# recommend_next_action
# ---------------------------------------------------------------------------

def recommend_next_action(
    student_id: str,
    district_id: str,
    user_id: str = "",
    case_id: Optional[str] = None,
) -> dict:
    """Synthesize data into a single recommended next action.

    Applies compliance ladder deterministically — no LLM call.
    """
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        current_year = os.getenv("CURRENT_SCHOOL_YEAR", "2025-2026")

        # District validation
        student_resp = (
            client.table("students")
            .select("id, district_id")
            .eq("id", student_id)
            .execute()
        )
        if not student_resp.data:
            raise ToolError("Student not found.", "recommend_next_action")
        if student_resp.data[0].get("district_id") != district_id:
            raise DistrictBoundaryViolation("recommend_next_action")

        # Attendance snapshot
        snap_resp = (
            client.table("attendance_snapshots")
            .select(
                "attendance_rate, days_absent_unexcused, "
                "days_truant, days_enrolled"
            )
            .eq("student_id", student_id)
            .eq("academic_year", current_year)
            .execute()
        )
        snap = snap_resp.data[0] if snap_resp.data else {}

        attendance_rate = _rate_to_decimal(snap.get("attendance_rate"))
        if attendance_rate is None:
            attendance_rate = 1.0
        unexcused = snap.get("days_absent_unexcused", 0) or 0
        truancy_count = snap.get("days_truant", 0) or 0

        # Active compliance case
        active_case = False
        tier1_complete = False
        tier2_complete = False
        sarb_eligible = False
        case_data: Optional[dict] = None

        if case_id:
            case_resp = (
                client.table("compliance_cases")
                .select(
                    "id, tier_requirements, truancy_count, "
                    "is_resolved"
                )
                .eq("id", case_id)
                .eq("student_id", student_id)
                .execute()
            )
            if case_resp.data and not case_resp.data[0].get("is_resolved"):
                case_data = case_resp.data[0]
                active_case = True
        else:
            # Look for any active case
            case_resp = (
                client.table("compliance_cases")
                .select(
                    "id, tier_requirements, truancy_count, "
                    "is_resolved"
                )
                .eq("student_id", student_id)
                .eq("is_resolved", False)
                .limit(1)
                .execute()
            )
            if case_resp.data:
                case_data = case_resp.data[0]
                active_case = True

        if case_data:
            tier_parsed = _parse_tier_requirements(
                case_data.get("tier_requirements")
            )
            tier1_complete = tier_parsed["tier1_complete"]
            tier2_complete = tier_parsed["tier2_complete"]

            # Use case truancy_count if available
            case_truancy = case_data.get("truancy_count", 0) or 0
            if case_truancy > 0:
                truancy_count = case_truancy

            # SARB eligibility check
            sarb_eligible = (
                (truancy_count >= 3 and tier1_complete and tier2_complete)
                or
                (attendance_rate <= 0.90 and tier1_complete and tier2_complete)
            )

        # Apply compliance ladder
        action_type, urgency, ec_citation = _apply_compliance_ladder(
            unexcused_absences=unexcused,
            truancy_count=truancy_count,
            attendance_rate=attendance_rate,
            tier1_complete=tier1_complete,
            tier2_complete=tier2_complete,
            sarb_eligible=sarb_eligible,
            active_case=active_case,
        )

        # Build rationale
        rationale = _build_rationale(
            action_type, unexcused, truancy_count,
            attendance_rate, tier1_complete, tier2_complete,
        )

        # Last intervention
        last_intervention: Optional[str] = None
        il_resp = (
            client.table("intervention_log")
            .select("intervention_type, intervention_date")
            .eq("student_id", student_id)
            .order("intervention_date", desc=True)
            .limit(1)
            .execute()
        )
        if il_resp.data:
            last = il_resp.data[0]
            last_intervention = "{} on {}".format(
                last.get("intervention_type", ""),
                last.get("intervention_date", ""),
            )

        # Blocked by
        blocked_by: Optional[str] = None
        if action_type == "sarb_referral" and not tier2_complete:
            blocked_by = "Tier 2 conference not complete"
        elif action_type == "conference" and not tier1_complete:
            blocked_by = "Tier 1 notification not sent"

        result = {
            "student_id": student_id,
            "recommended_action": _action_description(action_type),
            "action_type": action_type,
            "urgency": urgency,
            "rationale": rationale,
            "ec_citation": ec_citation,
            "supporting_data": {
                "attendance_rate": attendance_rate,
                "unexcused_absences": unexcused,
                "truancy_count": truancy_count,
                "tier1_complete": tier1_complete,
                "tier2_complete": tier2_complete,
                "last_intervention": last_intervention,
            },
            "blocked_by": blocked_by,
        }
        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "recommend_next_action")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="recommend_next_action",
            inputs_summary={
                "student_id": student_id,
                "case_id": case_id,
            },
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

_ACTION_DESCRIPTIONS = {
    "truancy_letter": "Send initial truancy notification letter",
    "conference": "Schedule attendance conference with parent/guardian",
    "sarb_referral": "Prepare and submit SARB referral packet",
    "counselor_referral": "Refer student to school counselor for support",
    "follow_up_call": "Make follow-up call to parent/guardian",
    "monitor": "Continue monitoring attendance",
    "close_case": "Close compliance case",
}


def _action_description(action_type: str) -> str:
    return _ACTION_DESCRIPTIONS.get(action_type, action_type)


def _build_rationale(
    action_type: str,
    unexcused: int,
    truancy_count: int,
    attendance_rate: float,
    tier1_complete: bool,
    tier2_complete: bool,
) -> str:
    """Build a human-readable rationale for the recommended action."""
    rate_pct = "{:.1%}".format(attendance_rate)

    if action_type == "counselor_referral":
        return (
            "Attendance rate ({}) is below 80%, indicating severe chronic "
            "absenteeism. Immediate counselor support recommended regardless "
            "of compliance tier status.".format(rate_pct)
        )

    if action_type == "truancy_letter":
        return (
            "Student has {} unexcused absences, meeting the truancy threshold "
            "per EC §48260. Initial notification letter is legally required."
            .format(unexcused)
        )

    if action_type == "conference":
        return (
            "Tier 1 notification complete. Student has {} truancy reports "
            "and {} attendance rate. Conference with parent/guardian required "
            "per EC §48262 before further escalation."
            .format(truancy_count, rate_pct)
        )

    if action_type == "sarb_referral":
        return (
            "Tiers 1 and 2 complete. Student meets SARB eligibility with "
            "{} truancy reports and {} attendance rate. SARB referral "
            "authorized per EC §48263.".format(truancy_count, rate_pct)
        )

    if action_type == "follow_up_call":
        return (
            "Tiers 1 and 2 complete but student does not yet meet SARB "
            "thresholds. Follow-up contact recommended to monitor progress. "
            "Current rate: {}.".format(rate_pct)
        )

    return (
        "No immediate compliance action required. Attendance rate: {}. "
        "Continue monitoring.".format(rate_pct)
    )
