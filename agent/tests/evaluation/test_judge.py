from __future__ import annotations

import json
import os
import tempfile

import pytest

from agent.evaluation.judge import EdveraEvaluationJudge, ScenarioResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_scenario_file(scenarios: list) -> str:
    """Write scenarios to a temp JSONL file and return its path."""
    f = tempfile.NamedTemporaryFile(
        mode="w", suffix=".jsonl", delete=False
    )
    for s in scenarios:
        f.write(json.dumps(s) + "\n")
    f.close()
    return f.name


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestEvaluateScenario:
    def test_passes_correct_output(self):
        scenario = {
            "scenario_id": "TEST-001",
            "description": "Test pass",
            "input": {},
            "expected_output": {
                "recommended_action_type": "truancy_letter",
                "ec_citation": "EC §48260",
            },
            "must_not_contain": ["sarb_referral"],
        }
        path = _make_scenario_file([scenario])
        judge = EdveraEvaluationJudge(path)

        result = judge.evaluate_scenario(
            scenario,
            {
                "recommendation": {
                    "action": "truancy_letter",
                    "ec_citation": "EC §48260",
                }
            },
        )
        assert result.passed is True
        assert len(result.failures) == 0
        os.unlink(path)

    def test_fails_wrong_action(self):
        scenario = {
            "scenario_id": "TEST-002",
            "description": "Wrong action",
            "input": {},
            "expected_output": {
                "recommended_action_type": "truancy_letter",
            },
            "must_not_contain": [],
        }
        path = _make_scenario_file([scenario])
        judge = EdveraEvaluationJudge(path)

        result = judge.evaluate_scenario(
            scenario,
            {"recommendation": {"action": "monitor"}},
        )
        assert result.passed is False
        assert any("truancy_letter" in f for f in result.failures)
        os.unlink(path)

    def test_fails_forbidden_term(self):
        scenario = {
            "scenario_id": "TEST-003",
            "description": "Test fail on forbidden term",
            "input": {},
            "expected_output": {},
            "must_not_contain": ["sarb_referral"],
        }
        path = _make_scenario_file([scenario])
        judge = EdveraEvaluationJudge(path)

        result = judge.evaluate_scenario(
            scenario,
            {"recommendation": {"action": "sarb_referral"}},
        )
        assert result.passed is False
        assert any("sarb_referral" in f for f in result.failures)
        os.unlink(path)

    def test_fails_missing_ec_citation(self):
        scenario = {
            "scenario_id": "TEST-004",
            "description": "Missing EC citation",
            "input": {},
            "expected_output": {
                "ec_citation": "EC §48260",
            },
            "must_not_contain": [],
        }
        path = _make_scenario_file([scenario])
        judge = EdveraEvaluationJudge(path)

        result = judge.evaluate_scenario(
            scenario,
            {"recommendation": {"action": "truancy_letter", "ec_citation": ""}},
        )
        assert result.passed is False
        assert any("EC §48260" in f for f in result.failures)
        os.unlink(path)

    def test_checks_sarb_eligible(self):
        scenario = {
            "scenario_id": "TEST-005",
            "description": "SARB eligibility check",
            "input": {},
            "expected_output": {
                "sarb_eligible": True,
            },
            "must_not_contain": [],
        }
        path = _make_scenario_file([scenario])
        judge = EdveraEvaluationJudge(path)

        result = judge.evaluate_scenario(
            scenario,
            {"compliance": {"sarb_eligible": True}},
        )
        assert result.passed is True

        result_fail = judge.evaluate_scenario(
            scenario,
            {"compliance": {"sarb_eligible": False}},
        )
        assert result_fail.passed is False
        os.unlink(path)

    def test_checks_output_contains(self):
        scenario = {
            "scenario_id": "TEST-006",
            "description": "Output contains check",
            "input": {},
            "expected_output": {
                "output_contains": ["truancy", "letter"],
            },
            "must_not_contain": [],
        }
        path = _make_scenario_file([scenario])
        judge = EdveraEvaluationJudge(path)

        result = judge.evaluate_scenario(
            scenario,
            {"message": "Send truancy letter to parent"},
        )
        assert result.passed is True

        result_fail = judge.evaluate_scenario(
            scenario,
            {"message": "Monitor attendance"},
        )
        assert result_fail.passed is False
        os.unlink(path)

    def test_valid_json_check(self):
        scenario = {
            "scenario_id": "TEST-007",
            "description": "Valid JSON check",
            "input": {},
            "expected_output": {
                "output_is_valid_json": True,
            },
            "must_not_contain": [],
        }
        path = _make_scenario_file([scenario])
        judge = EdveraEvaluationJudge(path)

        result = judge.evaluate_scenario(scenario, {"key": "value"})
        assert result.passed is True
        os.unlink(path)


class TestRunAll:
    def test_pass_rate_calculation(self):
        scenarios = [
            {
                "scenario_id": "TEST-{:03d}".format(i),
                "description": "Scenario {}".format(i),
                "input": {},
                "expected_output": {},
                "must_not_contain": [],
            }
            for i in range(20)
        ]
        path = _make_scenario_file(scenarios)
        judge = EdveraEvaluationJudge(path)

        summary = judge.run_all(lambda inp: {}, verbose=False)
        assert summary["pass_rate"] == 1.0
        assert summary["meets_threshold"] is True
        assert summary["total"] == 20
        assert summary["passed"] == 20
        assert summary["failed"] == 0
        os.unlink(path)

    def test_partial_failures(self):
        scenarios = [
            {
                "scenario_id": "PASS-001",
                "description": "Should pass",
                "input": {},
                "expected_output": {},
                "must_not_contain": [],
            },
            {
                "scenario_id": "FAIL-001",
                "description": "Should fail",
                "input": {},
                "expected_output": {
                    "recommended_action_type": "sarb_referral",
                },
                "must_not_contain": [],
            },
        ]
        path = _make_scenario_file(scenarios)
        judge = EdveraEvaluationJudge(path)

        summary = judge.run_all(lambda inp: {}, verbose=False)
        assert summary["passed"] == 1
        assert summary["failed"] == 1
        assert summary["pass_rate"] == 0.5
        assert summary["meets_threshold"] is False
        os.unlink(path)

    def test_agent_exception_handled(self):
        scenarios = [
            {
                "scenario_id": "ERR-001",
                "description": "Agent throws",
                "input": {},
                "expected_output": {},
                "must_not_contain": [],
            },
        ]
        path = _make_scenario_file(scenarios)
        judge = EdveraEvaluationJudge(path)

        def exploding_agent(inp):
            raise RuntimeError("boom")

        summary = judge.run_all(exploding_agent, verbose=False)
        assert summary["failed"] == 1
        assert "exception" in summary["results"][0]["failures"][0].lower()
        os.unlink(path)

    def test_loads_real_scenarios(self):
        """Verify the actual scenarios file loads without error."""
        from pathlib import Path
        scenarios_path = str(
            Path(__file__).resolve().parent.parent.parent
            / "evaluation" / "scenarios" / "attendance_compliance.jsonl"
        )
        judge = EdveraEvaluationJudge(scenarios_path)
        assert len(judge.scenarios) == 20
        # Verify each has required fields
        for s in judge.scenarios:
            assert "scenario_id" in s
            assert "description" in s
            assert "input" in s
            assert "expected_output" in s


class TestApiImports:
    def test_fastapi_app_importable(self):
        from agent.api.main import app
        assert app is not None
        assert app.title == "Edvera Attendance Operations Agent"

    def test_health_endpoint_exists(self):
        from agent.api.main import app
        routes = [r.path for r in app.routes]
        assert "/health" in routes

    def test_agent_endpoints_exist(self):
        from agent.api.main import app
        routes = [r.path for r in app.routes]
        assert "/agent/daily-brief" in routes
        assert "/agent/assess-student" in routes
