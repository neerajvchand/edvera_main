"""
Context tools — establish user identity, school scope, and county office info.
Always called first. No recommendation is made without context.
"""

from __future__ import annotations

import time
from typing import Optional

from agent.lib.supabase_client import get_supabase_client
from agent.lib.logging import log_tool_call
from agent.lib.tool_error import (
    ToolError,
    DistrictBoundaryViolation,
    UserContextError,
)


# ---------------------------------------------------------------------------
# get_current_user_context
# ---------------------------------------------------------------------------

def get_current_user_context(user_id: str) -> dict:
    """Establish the authenticated user's identity, role, and district.

    Called at the start of every agent invocation.
    """
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None
    district_id_resolved: Optional[str] = None

    try:
        # 1. Profile
        profile_resp = (
            client.table("profiles")
            .select("user_id, display_name, role")
            .eq("user_id", user_id)
            .execute()
        )
        if not profile_resp.data:
            raise UserContextError("get_current_user_context")

        profile = profile_resp.data[0]

        # 2. Schools via staff_memberships → schools → district
        memberships_resp = (
            client.table("staff_memberships")
            .select("school_id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )

        school_ids: list[str] = []
        for m in memberships_resp.data or []:
            if m.get("school_id"):
                school_ids.append(m["school_id"])

        if not school_ids:
            raise UserContextError("get_current_user_context")

        # Deduplicate
        school_ids = list(set(school_ids))

        # 3. Resolve district from the first school
        school_resp = (
            client.table("schools")
            .select("id, district_id")
            .in_("id", school_ids)
            .limit(1)
            .execute()
        )
        if not school_resp.data:
            raise UserContextError("get_current_user_context")

        district_id_resolved = school_resp.data[0]["district_id"]

        # 4. District name
        district_resp = (
            client.table("districts")
            .select("id, name")
            .eq("id", district_id_resolved)
            .single()
            .execute()
        )
        district_name = district_resp.data["name"] if district_resp.data else ""

        result = {
            "user_id": str(profile["user_id"]),
            "display_name": profile.get("display_name") or "",
            "role": profile.get("role") or "read_only",
            "district_id": str(district_id_resolved),
            "district_name": district_name,
            "school_ids": [str(sid) for sid in school_ids],
        }
        return result

    except (UserContextError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_current_user_context")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id_resolved or "",
            tool_name="get_current_user_context",
            inputs_summary={"user_id": user_id},
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# get_school_context
# ---------------------------------------------------------------------------

def get_school_context(school_id: str, district_id: str) -> dict:
    """Get school details for brief generation and document context.

    Validates the requesting user has access to this school via district_id.
    """
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        # School with district validation
        school_resp = (
            client.table("schools")
            .select("id, name, address, phone, principal_name, district_id")
            .eq("id", school_id)
            .eq("district_id", district_id)
            .execute()
        )

        if not school_resp.data:
            raise DistrictBoundaryViolation("get_school_context")

        school = school_resp.data[0]

        # District info
        district_resp = (
            client.table("districts")
            .select("id, name, county_office_id")
            .eq("id", district_id)
            .single()
            .execute()
        )
        district = district_resp.data or {}

        result = {
            "school_id": str(school["id"]),
            "name": school.get("name") or "",
            "address": school.get("address"),
            "phone": school.get("phone"),
            "principal_name": school.get("principal_name"),
            "district_id": str(district.get("id", district_id)),
            "district_name": district.get("name", ""),
            "county_office_id": str(district["county_office_id"])
            if district.get("county_office_id")
            else None,
        }
        return result

    except (DistrictBoundaryViolation,):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_school_context")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id="",
            district_id=district_id,
            tool_name="get_school_context",
            inputs_summary={"school_id": school_id, "district_id": district_id},
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# get_county_office_context
# ---------------------------------------------------------------------------

def get_county_office_context(county_office_id: str) -> dict:
    """Get county SARB coordinator details for brief and recommendations.

    Never hardcode SARB contact info — always fetch dynamically.
    """
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        resp = (
            client.table("county_offices")
            .select("*")
            .eq("id", county_office_id)
            .execute()
        )

        if not resp.data:
            raise ToolError(
                "County office not found.",
                "get_county_office_context",
            )

        row = resp.data[0]

        result = {
            "name": row.get("name", ""),
            "short_name": row.get("short_name"),
            "sarb_coordinator_name": row.get("sarb_coordinator_name"),
            "sarb_coordinator_email": row.get("sarb_coordinator_email"),
            "sarb_coordinator_phone": row.get("sarb_coordinator_phone"),
            "sarb_meeting_location": row.get("sarb_meeting_location"),
            "sarb_meeting_schedule": row.get("sarb_meeting_schedule"),
            "sarb_referral_instructions": row.get("sarb_referral_instructions"),
        }
        return result

    except ToolError:
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_county_office_context")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id="",
            district_id="",
            tool_name="get_county_office_context",
            inputs_summary={"county_office_id": county_office_id},
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )
