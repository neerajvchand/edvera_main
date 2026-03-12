"""
Evaluation harness for the Edvera Attendance Operations Agent.

Loads JSONL scenarios and evaluates agent output against expected
results. Reports pass/fail with specific failure reasons.

Modeled on ai_judge.py from the O'Reilly reference, adapted for
the Edvera compliance domain.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional


@dataclass
class ScenarioResult:
    scenario_id: str
    description: str
    passed: bool
    failures: list
    agent_output: dict


class EdveraEvaluationJudge:
    """Run evaluation scenarios against the agent and report results."""

    def __init__(self, scenarios_path: str):
        self.scenarios = self._load_scenarios(scenarios_path)

    def _load_scenarios(self, path: str) -> list:
        scenarios = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    raw = json.loads(line)
                    scenarios.append(self._normalize(raw))
        return scenarios

    @staticmethod
    def _normalize(raw: dict) -> dict:
        """Normalize scenario format.

        The JSONL file may use either the canonical evaluation format
        (scenario_id, expected_output, must_not_contain, input) or the
        attendance_compliance format (id, expected, student_data,
        compliance_data).  Map the latter into the canonical shape.
        """
        if "scenario_id" in raw:
            # Already canonical
            raw.setdefault("expected_output", {})
            raw.setdefault("must_not_contain", [])
            raw.setdefault("input", {})
            return raw

        # Map from attendance_compliance format
        expected_raw = raw.get("expected", {})
        return {
            "scenario_id": raw.get("id", ""),
            "description": raw.get("description", raw.get("name", "")),
            "input": {
                "student_data": raw.get("student_data", {}),
                "compliance_data": raw.get("compliance_data", {}),
            },
            "expected_output": {
                "recommended_action_type": expected_raw.get("action_type"),
                "ec_citation": expected_raw.get("ec_citation"),
                "sarb_eligible": expected_raw.get("sarb_eligible"),
            },
            "must_not_contain": raw.get("must_not_contain", []),
        }

    def evaluate_scenario(
        self,
        scenario: dict,
        agent_output: dict,
    ) -> ScenarioResult:
        """Evaluate a single scenario against agent output."""
        failures: list = []
        expected = scenario.get("expected_output", {})
        must_not = scenario.get("must_not_contain", [])

        output_str = json.dumps(agent_output).lower()

        # Check must_not_contain
        for forbidden in must_not:
            if forbidden.lower() in output_str:
                failures.append(
                    "Output contains forbidden term: '{}'".format(forbidden)
                )

        # Check expected action type
        if "recommended_action_type" in expected and expected["recommended_action_type"] is not None:
            actual = (
                agent_output.get("recommendation", {}).get("action", "")
                or agent_output.get("action_type", "")
                or agent_output.get("recommended_action_type", "")
            )
            if actual != expected["recommended_action_type"]:
                failures.append(
                    "Expected action '{}' but got '{}'".format(
                        expected["recommended_action_type"], actual
                    )
                )

        # Check EC citation
        if "ec_citation" in expected and expected["ec_citation"] is not None:
            actual_ec = (
                agent_output.get("recommendation", {}).get("ec_citation", "")
                or agent_output.get("ec_citation", "")
            )
            if expected["ec_citation"] not in str(actual_ec):
                failures.append(
                    "Expected EC citation '{}' not found in output".format(
                        expected["ec_citation"]
                    )
                )

        # Check sarb_eligible
        if "sarb_eligible" in expected:
            actual = agent_output.get("compliance", {}).get("sarb_eligible")
            if actual is None:
                actual = agent_output.get("sarb_eligible")
            if actual != expected["sarb_eligible"]:
                failures.append(
                    "Expected sarb_eligible={} but got {}".format(
                        expected["sarb_eligible"], actual
                    )
                )

        # Check output_contains
        if "output_contains" in expected:
            for phrase in expected["output_contains"]:
                if phrase.lower() not in output_str:
                    failures.append(
                        "Expected output to contain '{}'".format(phrase)
                    )

        # Check valid JSON
        if expected.get("output_is_valid_json"):
            if not isinstance(agent_output, dict):
                failures.append("Output is not valid JSON dict")

        return ScenarioResult(
            scenario_id=scenario["scenario_id"],
            description=scenario["description"],
            passed=len(failures) == 0,
            failures=failures,
            agent_output=agent_output,
        )

    def run_all(
        self,
        agent_fn: Callable,
        verbose: bool = True,
    ) -> dict:
        """Run all scenarios and return summary."""
        results: list = []
        passed = 0
        failed = 0

        for scenario in self.scenarios:
            if verbose:
                print(
                    "\nRunning {}: {}".format(
                        scenario["scenario_id"],
                        scenario["description"],
                    )
                )

            try:
                output = agent_fn(scenario["input"])
                result = self.evaluate_scenario(scenario, output)
            except Exception as e:
                result = ScenarioResult(
                    scenario_id=scenario["scenario_id"],
                    description=scenario["description"],
                    passed=False,
                    failures=["Agent raised exception: {}".format(str(e))],
                    agent_output={},
                )

            results.append(result)

            if result.passed:
                passed += 1
                if verbose:
                    print("  PASS")
            else:
                failed += 1
                if verbose:
                    print("  FAIL")
                    for f in result.failures:
                        print("     - {}".format(f))

        total = len(results)
        pass_rate = passed / total if total > 0 else 0

        summary = {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": round(pass_rate, 3),
            "meets_threshold": pass_rate >= 0.95,
            "results": [
                {
                    "scenario_id": r.scenario_id,
                    "passed": r.passed,
                    "failures": r.failures,
                }
                for r in results
            ],
        }

        if verbose:
            print("\n{}".format("=" * 50))
            print(
                "Results: {}/{} passed ({:.1f}%)".format(
                    passed, total, pass_rate * 100
                )
            )
            threshold_met = "MET" if summary["meets_threshold"] else "NOT MET"
            print("Threshold (95%): {}".format(threshold_met))

        return summary
