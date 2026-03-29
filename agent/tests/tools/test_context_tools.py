from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest
from agent.tools.context_tools import (
    get_current_user_context,
    get_school_context,
    get_county_office_context,
)
from agent.lib.tool_error import (
    ToolError,
    UserContextError,
    DistrictBoundaryViolation,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_client_chain():
    """Build a MagicMock that supports chained PostgREST calls."""
    m = MagicMock()
    # Every method returns itself so chaining works: .select().eq().execute()
    m.table.return_value = m
    m.select.return_value = m
    m.eq.return_value = m
    m.in_.return_value = m
    m.limit.return_value = m
    m.single.return_value = m
    return m


# ---------------------------------------------------------------------------
# get_current_user_context
# ---------------------------------------------------------------------------

class TestGetCurrentUserContext:
    @patch("agent.tools.context_tools.log_tool_call")
    @patch("agent.tools.context_tools.get_supabase_client")
    def test_success(self, mock_get_client, mock_log):
        client = MagicMock()
        mock_get_client.return_value = client

        # Profile query
        profile_resp = MagicMock()
        profile_resp.data = [
            {
                "user_id": "user-001",
                "display_name": "Test User",
                "role": "attendance_clerk",
            }
        ]

        # Staff memberships query
        membership_resp = MagicMock()
        membership_resp.data = [{"school_id": "sch-001"}]

        # School query (for district_id)
        school_resp = MagicMock()
        school_resp.data = [{"id": "sch-001", "district_id": "dist-001"}]

        # District query
        district_resp = MagicMock()
        district_resp.data = {"id": "dist-001", "name": "Test District"}

        # Wire up: each call to client.table() should return different results
        # depending on which table is queried. Use side_effect.
        call_count = {"n": 0}
        responses = [profile_resp, membership_resp, school_resp, district_resp]

        def fake_execute():
            idx = call_count["n"]
            call_count["n"] += 1
            return responses[idx]

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.in_.return_value = chain
        chain.limit.return_value = chain
        chain.single.return_value = chain
        chain.execute = fake_execute
        client.table.return_value = chain

        result = get_current_user_context("user-001")

        assert result["user_id"] == "user-001"
        assert result["role"] == "attendance_clerk"
        assert result["district_id"] == "dist-001"
        assert result["district_name"] == "Test District"
        assert "sch-001" in result["school_ids"]

    @patch("agent.tools.context_tools.log_tool_call")
    @patch("agent.tools.context_tools.get_supabase_client")
    def test_user_not_found(self, mock_get_client, mock_log):
        client = MagicMock()
        mock_get_client.return_value = client

        resp = MagicMock()
        resp.data = []

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = resp
        client.table.return_value = chain

        with pytest.raises(UserContextError):
            get_current_user_context("nonexistent-user")


# ---------------------------------------------------------------------------
# get_school_context
# ---------------------------------------------------------------------------

class TestGetSchoolContext:
    @patch("agent.tools.context_tools.log_tool_call")
    @patch("agent.tools.context_tools.get_supabase_client")
    def test_success(self, mock_get_client, mock_log):
        client = MagicMock()
        mock_get_client.return_value = client

        school_resp = MagicMock()
        school_resp.data = [
            {
                "id": "sch-001",
                "name": "Lincoln Elementary",
                "address": "123 Main St",
                "phone": "555-0100",
                "principal_name": "Dr. Smith",
                "district_id": "dist-001",
            }
        ]

        district_resp = MagicMock()
        district_resp.data = {
            "id": "dist-001",
            "name": "Pacific USD",
            "county_office_id": "co-001",
        }

        call_count = {"n": 0}
        responses = [school_resp, district_resp]

        def fake_execute():
            idx = call_count["n"]
            call_count["n"] += 1
            return responses[idx]

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.single.return_value = chain
        chain.execute = fake_execute
        client.table.return_value = chain

        result = get_school_context("sch-001", "dist-001")

        assert result["name"] == "Lincoln Elementary"
        assert result["district_name"] == "Pacific USD"
        assert result["county_office_id"] == "co-001"

    @patch("agent.tools.context_tools.log_tool_call")
    @patch("agent.tools.context_tools.get_supabase_client")
    def test_school_not_in_district(self, mock_get_client, mock_log):
        client = MagicMock()
        mock_get_client.return_value = client

        resp = MagicMock()
        resp.data = []

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = resp
        client.table.return_value = chain

        with pytest.raises(DistrictBoundaryViolation):
            get_school_context("sch-999", "dist-001")


# ---------------------------------------------------------------------------
# get_county_office_context
# ---------------------------------------------------------------------------

class TestGetCountyOfficeContext:
    @patch("agent.tools.context_tools.log_tool_call")
    @patch("agent.tools.context_tools.get_supabase_client")
    def test_success(self, mock_get_client, mock_log):
        client = MagicMock()
        mock_get_client.return_value = client

        resp = MagicMock()
        resp.data = [
            {
                "name": "Riverside COE",
                "short_name": "RCOE",
                "sarb_coordinator_name": "Jane Doe",
                "sarb_coordinator_email": "jdoe@rcoe.us",
                "sarb_coordinator_phone": "555-0200",
                "sarb_meeting_location": "101 County Rd",
                "sarb_meeting_schedule": "2nd Tuesday",
                "sarb_referral_instructions": "Submit via portal",
            }
        ]

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = resp
        client.table.return_value = chain

        result = get_county_office_context("co-001")

        assert result["name"] == "Riverside COE"
        assert result["sarb_coordinator_name"] == "Jane Doe"

    @patch("agent.tools.context_tools.log_tool_call")
    @patch("agent.tools.context_tools.get_supabase_client")
    def test_not_found(self, mock_get_client, mock_log):
        client = MagicMock()
        mock_get_client.return_value = client

        resp = MagicMock()
        resp.data = []

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.execute.return_value = resp
        client.table.return_value = chain

        with pytest.raises(ToolError):
            get_county_office_context("co-999")
