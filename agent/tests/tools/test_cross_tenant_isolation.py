"""Cross-tenant isolation tests.

Every tool that queries Supabase and accepts a district_id must raise
DistrictBoundaryViolation when the underlying data belongs to a
different district than the one the caller claims.

These tests mock the Supabase client so that the first entity lookup
(student or compliance_case → school) returns a *foreign* district_id,
and assert the tool rejects the request.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

from agent.lib.tool_error import DistrictBoundaryViolation


# ---------------------------------------------------------------------------
# Helpers — same chaining pattern used in test_context_tools.py
# ---------------------------------------------------------------------------

CALLER_DISTRICT = "dist-001"
FOREIGN_DISTRICT = "dist-999"


def _chain(responses: list):
    """Return a MagicMock Supabase client whose .execute() calls return
    *responses* in order.  Supports the full PostgREST chaining API.
    """
    client = MagicMock()
    call_count = {"n": 0}

    def fake_execute():
        idx = call_count["n"]
        call_count["n"] += 1
        resp = MagicMock()
        resp.data = responses[idx] if idx < len(responses) else []
        return resp

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.limit.return_value = chain
    chain.single.return_value = chain
    chain.order.return_value = chain
    chain.gte.return_value = chain
    chain.lt.return_value = chain
    chain.not_.return_value = chain
    chain.or_.return_value = chain
    chain.execute = fake_execute
    client.table.return_value = chain
    return client


# ===================================================================
# risk_tools
# ===================================================================


class TestGetStudentsAtRisk:
    """get_students_at_risk filters by school_ids in the caller's district.
    If a foreign school_id is passed, the schools query returns nothing
    and the tool returns an empty list (no data leak).
    """

    @patch("agent.tools.risk_tools.log_tool_call")
    @patch("agent.tools.risk_tools.get_supabase_client")
    def test_foreign_school_returns_empty(self, mock_get_client, mock_log):
        from agent.tools.risk_tools import get_students_at_risk

        # schools query for district returns no match for the foreign school
        client = _chain([
            [],  # schools query — no schools in caller's district match
        ])
        mock_get_client.return_value = client

        result = get_students_at_risk(
            district_id=CALLER_DISTRICT,
            school_id="sch-foreign",
        )
        assert result == []


class TestGetStudentAttendanceSummary:
    @patch("agent.tools.risk_tools.log_tool_call")
    @patch("agent.tools.risk_tools.get_supabase_client")
    def test_foreign_student_rejected(self, mock_get_client, mock_log):
        from agent.tools.risk_tools import get_student_attendance_summary

        client = _chain([
            # student query — returns student belonging to FOREIGN district
            [{"id": "stu-001", "first_name": "A", "last_name": "B",
              "grade_level": "5", "school_id": "sch-f",
              "state_student_id": None, "district_id": FOREIGN_DISTRICT}],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            get_student_attendance_summary(
                student_id="stu-001",
                district_id=CALLER_DISTRICT,
            )


class TestGetAbsencePattern:
    @patch("agent.tools.risk_tools.log_tool_call")
    @patch("agent.tools.risk_tools.get_supabase_client")
    def test_foreign_student_rejected(self, mock_get_client, mock_log):
        from agent.tools.risk_tools import get_absence_pattern

        client = _chain([
            [{"id": "stu-001", "district_id": FOREIGN_DISTRICT}],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            get_absence_pattern(
                student_id="stu-001",
                district_id=CALLER_DISTRICT,
            )


class TestPredictChronicAbsenteeismRisk:
    @patch("agent.tools.risk_tools.log_tool_call")
    @patch("agent.tools.risk_tools.get_supabase_client")
    def test_foreign_student_rejected(self, mock_get_client, mock_log):
        from agent.tools.risk_tools import predict_chronic_absenteeism_risk

        client = _chain([
            [{"id": "stu-001", "district_id": FOREIGN_DISTRICT}],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            predict_chronic_absenteeism_risk(
                student_id="stu-001",
                district_id=CALLER_DISTRICT,
            )


# ===================================================================
# compliance_tools
# ===================================================================


class TestGetComplianceCaseStatus:
    @patch("agent.tools.compliance_tools.log_tool_call")
    @patch("agent.tools.compliance_tools.get_supabase_client")
    def test_foreign_case_rejected(self, mock_get_client, mock_log):
        from agent.tools.compliance_tools import get_compliance_case_status

        client = _chain([
            # case query — returns case with school_id in foreign district
            [{"id": "case-001", "student_id": "stu-001",
              "school_id": "sch-foreign", "academic_year": "2025-2026",
              "current_tier": "tier_1_letter", "is_resolved": False,
              "tier_requirements": {}, "sarb_packet_status": None,
              "created_at": "2026-01-15T00:00:00Z",
              "truancy_count": 3, "unexcused_absence_count": 5}],
            # school district validation — no match (foreign district)
            [],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            get_compliance_case_status(
                case_id="case-001",
                district_id=CALLER_DISTRICT,
            )


class TestGetOpenActions:
    @patch("agent.tools.compliance_tools.log_tool_call")
    @patch("agent.tools.compliance_tools.get_supabase_client")
    def test_foreign_school_rejected(self, mock_get_client, mock_log):
        from agent.tools.compliance_tools import get_open_actions

        client = _chain([
            # actions query — returns an action at a foreign school
            [{"id": "act-001", "compliance_case_id": "case-001",
              "student_id": "stu-001", "action_type": "truancy_letter",
              "title": "Send letter", "priority": "high",
              "due_date": "2026-04-01", "status": "open",
              "assigned_to": None, "school_id": "sch-foreign"}],
            # school validation for the explicit school_id — no match
            [],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            get_open_actions(
                district_id=CALLER_DISTRICT,
                school_id="sch-foreign",
            )


class TestGetTierRequirements:
    @patch("agent.tools.compliance_tools.log_tool_call")
    @patch("agent.tools.compliance_tools.get_supabase_client")
    def test_foreign_case_rejected(self, mock_get_client, mock_log):
        from agent.tools.compliance_tools import get_tier_requirements

        client = _chain([
            # case query
            [{"id": "case-001", "tier_requirements": {},
              "school_id": "sch-foreign"}],
            # school district validation — empty = foreign
            [],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            get_tier_requirements(
                case_id="case-001",
                district_id=CALLER_DISTRICT,
            )


class TestCheckSarbEligibility:
    @patch("agent.tools.compliance_tools.log_tool_call")
    @patch("agent.tools.compliance_tools.get_supabase_client")
    def test_foreign_case_rejected(self, mock_get_client, mock_log):
        from agent.tools.compliance_tools import check_sarb_eligibility

        client = _chain([
            # case query
            [{"id": "case-001", "student_id": "stu-001",
              "school_id": "sch-foreign",
              "tier_requirements": {}, "truancy_count": 5}],
            # school district validation — empty = foreign
            [],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            check_sarb_eligibility(
                student_id="stu-001",
                case_id="case-001",
                district_id=CALLER_DISTRICT,
            )


# ===================================================================
# intervention_tools
# ===================================================================


class TestGetInterventionHistory:
    @patch("agent.tools.intervention_tools.log_tool_call")
    @patch("agent.tools.intervention_tools.get_supabase_client")
    def test_foreign_student_rejected(self, mock_get_client, mock_log):
        from agent.tools.intervention_tools import get_intervention_history

        client = _chain([
            [{"id": "stu-001", "district_id": FOREIGN_DISTRICT}],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            get_intervention_history(
                student_id="stu-001",
                district_id=CALLER_DISTRICT,
            )


class TestRecommendNextAction:
    @patch("agent.tools.intervention_tools.log_tool_call")
    @patch("agent.tools.intervention_tools.get_supabase_client")
    def test_foreign_student_rejected(self, mock_get_client, mock_log):
        from agent.tools.intervention_tools import recommend_next_action

        client = _chain([
            [{"id": "stu-001", "district_id": FOREIGN_DISTRICT}],
        ])
        mock_get_client.return_value = client

        with pytest.raises(DistrictBoundaryViolation):
            recommend_next_action(
                student_id="stu-001",
                district_id=CALLER_DISTRICT,
            )
