from __future__ import annotations

from unittest.mock import patch, MagicMock
import pytest

from agent.tools.brief_tools import generate_school_brief


class TestGenerateSchoolBrief:
    @patch("agent.tools.brief_tools.get_supabase_client")
    @patch("agent.tools.brief_tools.recommend_next_action")
    @patch("agent.tools.brief_tools.get_open_actions")
    @patch("agent.tools.brief_tools.get_students_at_risk")
    @patch("agent.tools.brief_tools.get_school_context")
    @patch("agent.tools.brief_tools.log_tool_call")
    def test_brief_output_schema(
        self,
        mock_log,
        mock_school,
        mock_risk,
        mock_actions,
        mock_rec,
        mock_client,
    ):
        mock_school.return_value = {
            "school_id": "sch-001",
            "name": "Test School",
            "district_id": "dist-001",
        }
        mock_risk.return_value = [
            {
                "student_id": "stu-001",
                "student_name": "Test Student",
                "chronic_band": "moderate",
                "active_case_id": None,
                "truancy_count": 3,
                "trend_delta": -0.04,
            }
        ]
        mock_rec.return_value = {
            "recommended_action": "truancy_letter",
            "action_type": "truancy_letter",
            "urgency": "urgent",
            "rationale": "Student has 3 unexcused absences",
            "ec_citation": "EC §48260",
        }
        mock_actions.return_value = []

        # Mock supabase client for approval query
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        resp = MagicMock()
        resp.data = []
        chain.execute.return_value = resp
        mock_client.return_value.table.return_value = chain

        brief = generate_school_brief(
            school_id="sch-001",
            district_id="dist-001",
            user_id="user-001",
        )

        # Schema checks
        assert brief["brief_type"] == "school"
        assert "generated_at" in brief
        assert brief["school_id"] == "sch-001"
        assert brief["district_id"] == "dist-001"
        assert brief["school_name"] == "Test School"

        # Summary
        assert "summary" in brief
        summary = brief["summary"]
        assert "trend_direction" in summary
        assert "trend_delta" in summary

        # Action items
        assert "action_items" in brief
        assert len(brief["action_items"]) == 1
        item = brief["action_items"][0]
        assert item["action_type"] == "truancy_letter"
        assert item["priority"] == "urgent"
        assert item["ec_citation"] == "EC §48260"
        assert item["student_name"] == "Test Student"

        # Requires approval
        assert "requires_approval" in brief
        assert len(brief["requires_approval"]) == 0

        # Risk summary
        assert "risk_summary" in brief
        rs = brief["risk_summary"]
        assert rs["moderate_count"] == 1
        assert rs["at_risk_count"] == 0
        assert rs["severe_count"] == 0
        assert rs["new_truancy_threshold_crossings"] == 1  # truancy>=3 & no case

    @patch("agent.tools.brief_tools.get_supabase_client")
    @patch("agent.tools.brief_tools.get_open_actions")
    @patch("agent.tools.brief_tools.get_students_at_risk")
    @patch("agent.tools.brief_tools.get_school_context")
    @patch("agent.tools.brief_tools.log_tool_call")
    def test_brief_empty_school(
        self,
        mock_log,
        mock_school,
        mock_risk,
        mock_actions,
        mock_client,
    ):
        mock_school.return_value = {
            "school_id": "sch-001",
            "name": "Empty School",
            "district_id": "dist-001",
        }
        mock_risk.return_value = []
        mock_actions.return_value = []

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        resp = MagicMock()
        resp.data = []
        chain.execute.return_value = resp
        mock_client.return_value.table.return_value = chain

        brief = generate_school_brief("sch-001", "dist-001", "user-001")

        assert brief["brief_type"] == "school"
        assert len(brief["action_items"]) == 0
        assert brief["risk_summary"]["at_risk_count"] == 0
        assert brief["risk_summary"]["moderate_count"] == 0
        assert brief["risk_summary"]["severe_count"] == 0
        assert brief["risk_summary"]["new_truancy_threshold_crossings"] == 0

    @patch("agent.tools.brief_tools.get_supabase_client")
    @patch("agent.tools.brief_tools.recommend_next_action")
    @patch("agent.tools.brief_tools.get_open_actions")
    @patch("agent.tools.brief_tools.get_students_at_risk")
    @patch("agent.tools.brief_tools.get_school_context")
    @patch("agent.tools.brief_tools.log_tool_call")
    def test_monitor_actions_excluded(
        self,
        mock_log,
        mock_school,
        mock_risk,
        mock_actions,
        mock_rec,
        mock_client,
    ):
        """Students where recommendation is 'monitor' should not appear in action_items."""
        mock_school.return_value = {
            "school_id": "sch-001",
            "name": "Test School",
            "district_id": "dist-001",
        }
        mock_risk.return_value = [
            {
                "student_id": "stu-001",
                "student_name": "Monitor Student",
                "chronic_band": "at-risk",
                "active_case_id": "case-001",
                "truancy_count": 1,
                "trend_delta": 0.0,
            }
        ]
        mock_rec.return_value = {
            "recommended_action": "Continue monitoring attendance",
            "action_type": "monitor",
            "urgency": "routine",
            "rationale": "No immediate action needed",
            "ec_citation": None,
        }
        mock_actions.return_value = []

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        resp = MagicMock()
        resp.data = []
        chain.execute.return_value = resp
        mock_client.return_value.table.return_value = chain

        brief = generate_school_brief("sch-001", "dist-001", "user-001")
        assert len(brief["action_items"]) == 0

    @patch("agent.tools.brief_tools.get_supabase_client")
    @patch("agent.tools.brief_tools.recommend_next_action")
    @patch("agent.tools.brief_tools.get_open_actions")
    @patch("agent.tools.brief_tools.get_students_at_risk")
    @patch("agent.tools.brief_tools.get_school_context")
    @patch("agent.tools.brief_tools.log_tool_call")
    def test_urgency_sort_order(
        self,
        mock_log,
        mock_school,
        mock_risk,
        mock_actions,
        mock_rec,
        mock_client,
    ):
        """Action items should be sorted urgent first."""
        mock_school.return_value = {
            "school_id": "sch-001",
            "name": "Test School",
            "district_id": "dist-001",
        }
        mock_risk.return_value = [
            {
                "student_id": "stu-001",
                "student_name": "Routine Student",
                "chronic_band": "at-risk",
                "active_case_id": "case-001",
                "truancy_count": 2,
                "trend_delta": 0.0,
            },
            {
                "student_id": "stu-002",
                "student_name": "Urgent Student",
                "chronic_band": "severe",
                "active_case_id": None,
                "truancy_count": 5,
                "trend_delta": -0.05,
            },
        ]

        call_count = {"n": 0}
        recs = [
            {
                "recommended_action": "Follow up",
                "action_type": "follow_up_call",
                "urgency": "routine",
                "rationale": "Follow up needed",
                "ec_citation": None,
            },
            {
                "recommended_action": "Send letter",
                "action_type": "truancy_letter",
                "urgency": "urgent",
                "rationale": "Threshold crossed",
                "ec_citation": "EC §48260",
            },
        ]

        def fake_rec(**kwargs):
            idx = call_count["n"]
            call_count["n"] += 1
            return recs[idx]

        mock_rec.side_effect = fake_rec
        mock_actions.return_value = []

        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        resp = MagicMock()
        resp.data = []
        chain.execute.return_value = resp
        mock_client.return_value.table.return_value = chain

        brief = generate_school_brief("sch-001", "dist-001", "user-001")

        assert len(brief["action_items"]) == 2
        # Urgent should come first
        assert brief["action_items"][0]["priority"] == "urgent"
        assert brief["action_items"][1]["priority"] == "routine"


class TestGraphCompilation:
    def test_graph_compiles(self):
        from agent.agent import construct_graph
        g = construct_graph()
        assert g is not None

    def test_run_agent_callable(self):
        from agent.agent import run_agent
        assert callable(run_agent)

    def test_state_has_required_keys(self):
        from agent.agent import EdveraState
        keys = list(EdveraState.__annotations__.keys())
        assert "user_id" in keys
        assert "district_id" in keys
        assert "request_type" in keys
        assert "request_payload" in keys
        assert "messages" in keys
        assert "tool_results" in keys
        assert "final_output" in keys

    def test_system_prompt_content(self):
        from agent.agent import SYSTEM_PROMPT
        assert "Edvera Attendance Operations Agent" in SYSTEM_PROMPT
        assert "EC section" in SYSTEM_PROMPT
        assert "JSON" in SYSTEM_PROMPT
