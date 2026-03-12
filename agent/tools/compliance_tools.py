"""
Compliance tools — tier status, open actions, SARB eligibility, EC lookup.
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
from agent.lib.ec_sections import lookup_section
from agent.tools.risk_tools import _parse_tier, _rate_to_decimal


# ---------------------------------------------------------------------------
# Tier requirement keys — mirrors getCaseWorkspace.ts buildTierChecklist()
# ---------------------------------------------------------------------------
# JSONB top-level keys are tier_1, tier_2, tier_3 (matching TypeScript).
# The item keys below must match exactly to produce identical results.

_TIER_ITEM_KEYS: dict[str, list[tuple[str, str, str]]] = {
    # (jsonb_key, label, source)
    "tier_1": [
        ("notification_sent", "Notification sent", "action"),
        ("notification_language_compliant", "Legal language (EC §48260.5)", "document"),
    ],
    "tier_2": [
        ("conference_held", "Conference held or attempted", "action"),
        ("resources_offered", "Resources offered", "action"),
        ("consequences_explained", "Consequences explained (EC §48262)", "action"),
    ],
    "tier_3": [
        ("packet_assembled", "Packet assembled", "document"),
        ("prior_tiers_documented", "Prior tiers documented", "approval"),
        ("referral_submitted", "Referral submitted", "document"),
    ],
}


# ---------------------------------------------------------------------------
# Helpers — exported for testing
# ---------------------------------------------------------------------------

def _extract_item(data: dict, key: str, label: str, source: str) -> dict:
    """Extract a single tier checklist item from JSONB data.

    Mirrors getCaseWorkspace.ts extractItem() exactly.
    """
    val = data.get(key)
    if isinstance(val, dict):
        completed_at = val.get("completedAt") or val.get("date")
        return {
            "key": key,
            "label": label,
            "completed": bool(val.get("completed", False)),
            "completed_at": completed_at if isinstance(completed_at, str) else None,
            "source": source,
        }
    if isinstance(val, bool):
        return {
            "key": key,
            "label": label,
            "completed": val,
            "completed_at": None,
            "source": source,
        }
    return {
        "key": key,
        "label": label,
        "completed": False,
        "completed_at": None,
        "source": source,
    }


def _parse_tier_requirements(raw: Optional[dict]) -> dict:
    """Parse tier_requirements JSONB into structured checklist.

    Identical logic to getCaseWorkspace.ts buildTierChecklist().
    Returns dict with tier1/tier2/tier3 lists plus *_complete booleans
    and individual key booleans for the TOOL_SPEC output shape.
    """
    tr = raw or {}
    t1_data = tr.get("tier_1") or {}
    t2_data = tr.get("tier_2") or {}
    t3_data = tr.get("tier_3") or {}

    tier_data = {"tier_1": t1_data, "tier_2": t2_data, "tier_3": t3_data}

    checklist: dict[str, list[dict]] = {}
    for tier_key, items in _TIER_ITEM_KEYS.items():
        checklist[tier_key] = [
            _extract_item(tier_data[tier_key], key, label, source)
            for key, label, source in items
        ]

    tier1_complete = all(item["completed"] for item in checklist["tier_1"])
    tier2_complete = all(item["completed"] for item in checklist["tier_2"])
    tier3_complete = all(item["completed"] for item in checklist["tier_3"])

    # Individual key booleans (for get_tier_requirements output shape)
    notification_sent = t1_data.get("notification_sent", {})
    if isinstance(notification_sent, dict):
        notification_sent = bool(notification_sent.get("completed", False))
    else:
        notification_sent = bool(notification_sent) if notification_sent else False

    legal_language = t1_data.get("notification_language_compliant", {})
    if isinstance(legal_language, dict):
        legal_language = bool(legal_language.get("completed", False))
    else:
        legal_language = bool(legal_language) if legal_language else False

    def _bool_from_jsonb(data: dict, key: str) -> bool:
        val = data.get(key, {})
        if isinstance(val, dict):
            return bool(val.get("completed", False))
        return bool(val) if val else False

    return {
        "tier_requirements": {
            "tier1": checklist["tier_1"],
            "tier2": checklist["tier_2"],
            "tier3": checklist["tier_3"],
        },
        "tier1_complete": tier1_complete,
        "tier2_complete": tier2_complete,
        "tier3_complete": tier3_complete,
        # Individual booleans
        "notification_sent": notification_sent,
        "legal_language": legal_language,
        "conference_held": _bool_from_jsonb(t2_data, "conference_held"),
        "resources_offered": _bool_from_jsonb(t2_data, "resources_offered"),
        "consequences_explained": _bool_from_jsonb(t2_data, "consequences_explained"),
        "packet_assembled": _bool_from_jsonb(t3_data, "packet_assembled"),
        "prior_tiers_documented": _bool_from_jsonb(t3_data, "prior_tiers_documented"),
        "referral_submitted": _bool_from_jsonb(t3_data, "referral_submitted"),
    }


# ===================================================================
# PUBLIC TOOL FUNCTIONS
# ===================================================================


# ---------------------------------------------------------------------------
# get_compliance_case_status
# ---------------------------------------------------------------------------

def get_compliance_case_status(
    case_id: str,
    district_id: str,
    user_id: str = "",
) -> dict:
    """Full compliance picture for a single case."""
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        # Case with district validation via school
        case_resp = (
            client.table("compliance_cases")
            .select(
                "id, student_id, school_id, academic_year, "
                "current_tier, is_resolved, "
                "tier_requirements, sarb_packet_status, "
                "created_at, "
                "truancy_count, unexcused_absence_count"
            )
            .eq("id", case_id)
            .execute()
        )
        if not case_resp.data:
            raise ToolError("Compliance case not found.", "get_compliance_case_status")

        case = case_resp.data[0]

        # Validate district via school
        school_resp = (
            client.table("schools")
            .select("id, district_id")
            .eq("id", case["school_id"])
            .eq("district_id", district_id)
            .execute()
        )
        if not school_resp.data:
            raise DistrictBoundaryViolation("get_compliance_case_status")

        # Student name
        student_resp = (
            client.table("students")
            .select("first_name, last_name")
            .eq("id", case["student_id"])
            .single()
            .execute()
        )
        student = student_resp.data or {}
        student_name = "{} {}".format(
            student.get("first_name", ""),
            student.get("last_name", ""),
        )

        # Parse tier requirements
        tier_parsed = _parse_tier_requirements(case.get("tier_requirements"))

        # Days since opened
        opened_at = case.get("created_at")
        days_since_opened = 0
        if opened_at:
            try:
                opened_date = datetime.datetime.fromisoformat(
                    str(opened_at).replace("Z", "+00:00")
                ).date()
                days_since_opened = (datetime.date.today() - opened_date).days
            except (ValueError, TypeError):
                pass

        # Count overdue actions
        overdue_resp = (
            client.table("actions")
            .select("id")
            .eq("compliance_case_id", case_id)
            .eq("status", "open")
            .lt("due_date", datetime.date.today().isoformat())
            .execute()
        )
        overdue_count = len(overdue_resp.data or [])

        # Map status
        status = "resolved" if case.get("is_resolved") else "open"

        result = {
            "case_id": str(case["id"]),
            "student_id": str(case["student_id"]),
            "student_name": student_name,
            "school_id": str(case["school_id"]),
            "current_tier": _parse_tier(case.get("current_tier")),
            "status": status,
            "opened_at": str(opened_at) if opened_at else None,
            "tier_requirements": tier_parsed["tier_requirements"],
            "tier1_complete": tier_parsed["tier1_complete"],
            "tier2_complete": tier_parsed["tier2_complete"],
            "tier3_complete": tier_parsed["tier3_complete"],
            "sarb_packet_status": case.get("sarb_packet_status"),
            "days_since_opened": days_since_opened,
            "overdue_actions_count": overdue_count,
        }
        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_compliance_case_status")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="get_compliance_case_status",
            inputs_summary={"case_id": case_id},
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# get_open_actions
# ---------------------------------------------------------------------------

def get_open_actions(
    district_id: str,
    user_id: str = "",
    case_id: Optional[str] = None,
    school_id: Optional[str] = None,
    status_filter: Optional[list[str]] = None,
    limit: int = 50,
) -> list[dict]:
    """Open, overdue, and blocked actions for a case, school, or district."""
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[list] = None

    if status_filter is None:
        status_filter = ["open", "overdue"]

    try:
        # Build query — PostgREST cannot do computed columns, so we
        # fetch raw and compute is_overdue / days_overdue in Python.
        query = (
            client.table("actions")
            .select(
                "id, compliance_case_id, student_id, "
                "action_type, title, priority, due_date, status, "
                "assigned_to, school_id"
            )
        )

        # Filter by case
        if case_id:
            query = query.eq("compliance_case_id", case_id)

        # Filter by school
        if school_id:
            query = query.eq("school_id", school_id)

        # Status filter — "overdue" is virtual, so include "open" for it
        db_statuses = list(set(s for s in status_filter if s != "overdue"))
        if "overdue" in status_filter and "open" not in db_statuses:
            db_statuses.append("open")
        if db_statuses:
            query = query.in_("status", db_statuses)

        query = query.order("due_date").limit(limit)
        actions_resp = query.execute()
        raw_actions = actions_resp.data or []

        if not raw_actions:
            result = []
            return result

        # District validation — get school_ids in district
        school_ids_in_district: set[str] = set()
        if school_id:
            # Validate single school
            sch_resp = (
                client.table("schools")
                .select("id")
                .eq("id", school_id)
                .eq("district_id", district_id)
                .execute()
            )
            if not sch_resp.data:
                raise DistrictBoundaryViolation("get_open_actions")
            school_ids_in_district.add(school_id)
        else:
            # Get all schools in district for validation
            sch_resp = (
                client.table("schools")
                .select("id")
                .eq("district_id", district_id)
                .execute()
            )
            school_ids_in_district = {s["id"] for s in (sch_resp.data or [])}

        # Filter actions to district schools only
        raw_actions = [
            a for a in raw_actions
            if a.get("school_id") in school_ids_in_district
        ]

        # Collect student IDs and assigned_to IDs for bulk lookups
        student_ids = list(set(a["student_id"] for a in raw_actions if a.get("student_id")))
        assigned_ids = list(set(a["assigned_to"] for a in raw_actions if a.get("assigned_to")))

        # Student names
        student_map: dict[str, str] = {}
        if student_ids:
            stu_resp = (
                client.table("students")
                .select("id, first_name, last_name")
                .in_("id", student_ids)
                .execute()
            )
            for s in (stu_resp.data or []):
                student_map[s["id"]] = "{} {}".format(
                    s.get("first_name", ""), s.get("last_name", "")
                )

        # Assigned-to names
        assigned_map: dict[str, str] = {}
        if assigned_ids:
            prof_resp = (
                client.table("profiles")
                .select("user_id, display_name")
                .in_("user_id", assigned_ids)
                .execute()
            )
            for p in (prof_resp.data or []):
                assigned_map[p["user_id"]] = p.get("display_name", "")

        today = datetime.date.today()

        result = []
        for a in raw_actions:
            due = a.get("due_date")
            is_overdue = False
            days_overdue = None
            if due and a.get("status") != "completed":
                try:
                    due_date = datetime.date.fromisoformat(str(due)[:10])
                    if due_date < today:
                        is_overdue = True
                        days_overdue = (today - due_date).days
                except (ValueError, TypeError):
                    pass

            # Apply overdue-only filter
            if status_filter == ["overdue"] and not is_overdue:
                continue

            result.append({
                "action_id": str(a["id"]),
                "case_id": str(a["compliance_case_id"]) if a.get("compliance_case_id") else None,
                "student_id": str(a["student_id"]),
                "student_name": student_map.get(a["student_id"], ""),
                "action_type": a.get("action_type", ""),
                "title": a.get("title", ""),
                "priority": a.get("priority", "normal"),
                "due_date": str(due) if due else None,
                "is_overdue": is_overdue,
                "days_overdue": days_overdue,
                "status": a.get("status", ""),
                "assigned_to_name": assigned_map.get(a.get("assigned_to", ""), None),
            })

        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_open_actions")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="get_open_actions",
            inputs_summary={
                "case_id": case_id,
                "school_id": school_id,
                "limit": limit,
            },
            output_summary="{} actions".format(len(result) if result else 0),
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# get_tier_requirements
# ---------------------------------------------------------------------------

def get_tier_requirements(
    case_id: str,
    district_id: str,
    user_id: str = "",
) -> dict:
    """Read tier_requirements JSONB and return structured checklist state."""
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        case_resp = (
            client.table("compliance_cases")
            .select("id, tier_requirements, school_id")
            .eq("id", case_id)
            .execute()
        )
        if not case_resp.data:
            raise ToolError("Compliance case not found.", "get_tier_requirements")

        case = case_resp.data[0]

        # District validation
        school_resp = (
            client.table("schools")
            .select("id")
            .eq("id", case["school_id"])
            .eq("district_id", district_id)
            .execute()
        )
        if not school_resp.data:
            raise DistrictBoundaryViolation("get_tier_requirements")

        raw = case.get("tier_requirements") or {}
        parsed = _parse_tier_requirements(raw)

        result = {
            "case_id": str(case["id"]),
            "tier_requirements_raw": raw,
            "notification_sent": parsed["notification_sent"],
            "legal_language": parsed["legal_language"],
            "conference_held": parsed["conference_held"],
            "resources_offered": parsed["resources_offered"],
            "consequences_explained": parsed["consequences_explained"],
            "packet_assembled": parsed["packet_assembled"],
            "prior_tiers_documented": parsed["prior_tiers_documented"],
            "referral_submitted": parsed["referral_submitted"],
            "tier1_complete": parsed["tier1_complete"],
            "tier2_complete": parsed["tier2_complete"],
            "tier3_complete": parsed["tier3_complete"],
        }
        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_tier_requirements")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="get_tier_requirements",
            inputs_summary={"case_id": case_id},
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# check_sarb_eligibility
# ---------------------------------------------------------------------------

def check_sarb_eligibility(
    student_id: str,
    case_id: str,
    district_id: str,
    user_id: str = "",
) -> dict:
    """Determine SARB referral eligibility per EC §48263."""
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        current_year = os.getenv("CURRENT_SCHOOL_YEAR", "2025-2026")

        # Case + district validation
        case_resp = (
            client.table("compliance_cases")
            .select(
                "id, student_id, school_id, "
                "tier_requirements, truancy_count"
            )
            .eq("id", case_id)
            .eq("student_id", student_id)
            .execute()
        )
        if not case_resp.data:
            raise ToolError(
                "Compliance case not found for student.",
                "check_sarb_eligibility",
            )

        case = case_resp.data[0]

        school_resp = (
            client.table("schools")
            .select("id")
            .eq("id", case["school_id"])
            .eq("district_id", district_id)
            .execute()
        )
        if not school_resp.data:
            raise DistrictBoundaryViolation("check_sarb_eligibility")

        # Attendance snapshot for rate
        snap_resp = (
            client.table("attendance_snapshots")
            .select("attendance_rate, days_truant")
            .eq("student_id", student_id)
            .eq("academic_year", current_year)
            .execute()
        )
        snap = snap_resp.data[0] if snap_resp.data else {}

        attendance_rate = _rate_to_decimal(snap.get("attendance_rate"))
        if attendance_rate is None:
            attendance_rate = 1.0  # default to full if no data

        truancy_count = case.get("truancy_count", 0) or snap.get("days_truant", 0) or 0

        # Parse tiers
        tier_parsed = _parse_tier_requirements(case.get("tier_requirements"))
        tier1_complete = tier_parsed["tier1_complete"]
        tier2_complete = tier_parsed["tier2_complete"]

        # SARB eligibility logic per EC §48263
        sarb_eligible = (
            (truancy_count >= 3 and tier1_complete and tier2_complete)
            or
            (attendance_rate <= 0.90 and tier1_complete and tier2_complete)
        )

        # Blocking reasons
        blocking_reasons: list[str] = []
        if not tier1_complete:
            blocking_reasons.append(
                "Tier 1 notification has not been sent per EC §48260.5. "
                "Complete Tier 1 before SARB referral."
            )
        if not tier2_complete:
            blocking_reasons.append(
                "Tier 2 conference has not been held or attempted per EC §48262. "
                "Complete Tier 2 before SARB referral."
            )
        if truancy_count < 3 and attendance_rate > 0.90:
            blocking_reasons.append(
                "Student does not yet meet habitual truant threshold "
                "(3+ reports) per EC §48262 or chronic absentee threshold "
                "per EC §48263."
            )

        # Eligibility basis
        eligibility_basis: Optional[str] = None
        if sarb_eligible:
            if truancy_count >= 3:
                eligibility_basis = (
                    "Habitual truant — {} truancy reports filed (≥3 required "
                    "per EC §48262)".format(truancy_count)
                )
            elif attendance_rate <= 0.90:
                eligibility_basis = (
                    "Chronic absentee — attendance rate {:.1%} (≤90% threshold "
                    "per EC §48263)".format(attendance_rate)
                )

        # Recommendation
        if sarb_eligible:
            recommendation = (
                "Student is eligible for SARB referral. "
                "Prepare referral packet per EC §48263."
            )
        elif blocking_reasons:
            recommendation = (
                "Complete the following before SARB referral: "
                + "; ".join(blocking_reasons)
            )
        else:
            recommendation = "Continue monitoring attendance."

        result = {
            "student_id": student_id,
            "case_id": case_id,
            "sarb_eligible": sarb_eligible,
            "eligibility_basis": eligibility_basis,
            "ec_citation": "EC §48263",
            "blocking_reasons": blocking_reasons,
            "tier1_complete": tier1_complete,
            "tier2_complete": tier2_complete,
            "truancy_count": truancy_count,
            "attendance_rate": attendance_rate,
            "recommendation": recommendation,
        }
        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "check_sarb_eligibility")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="check_sarb_eligibility",
            inputs_summary={
                "student_id": student_id,
                "case_id": case_id,
            },
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# lookup_education_code
# ---------------------------------------------------------------------------

def lookup_education_code(section: str) -> Optional[dict]:
    """Return EC section details from static data.

    No database query. No LLM call.
    If section not found, returns None and logs warning.
    """
    ec = lookup_section(section)
    if ec is None:
        print("[WARN] EC section not found: {}".format(section))
        return None

    return {
        "section": ec.section,
        "citation": ec.citation,
        "title": ec.title,
        "effective_date": ec.effective_date,
        "summary": ec.summary,
        "tags": list(ec.tags),
        "used_in": list(ec.used_in),
    }
