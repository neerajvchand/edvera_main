#!/usr/bin/env python3
"""
Run the full evaluation suite against the Edvera agent.

Usage:
    python -m agent.evaluation.run_eval

Exit codes:
    0 — evaluation passed (>= 95% pass rate)
    1 — evaluation failed
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from agent.evaluation.judge import EdveraEvaluationJudge
from agent.agent import run_agent


def agent_wrapper(scenario_input: dict) -> dict:
    """Adapt scenario input to run_agent interface."""
    user_ctx = scenario_input.get("user_context", {})
    return run_agent(
        user_id=user_ctx.get("user_id", "eval-user"),
        district_id=user_ctx.get("district_id", "dist-001"),
        request_type=scenario_input.get("request_type", "assess_student"),
        payload=scenario_input,
    )


def main():
    # Resolve paths relative to agent/ directory
    agent_dir = Path(__file__).resolve().parent.parent
    scenarios_path = str(
        agent_dir / "evaluation" / "scenarios" / "attendance_compliance.jsonl"
    )
    results_path = str(
        agent_dir / "evaluation" / "last_eval_results.json"
    )

    if not Path(scenarios_path).exists():
        print("Scenarios file not found: {}".format(scenarios_path))
        sys.exit(1)

    judge = EdveraEvaluationJudge(scenarios_path)
    summary = judge.run_all(agent_wrapper, verbose=True)

    # Save results
    with open(results_path, "w") as f:
        json.dump(summary, f, indent=2)

    print("\nResults saved to {}".format(results_path))

    if not summary["meets_threshold"]:
        print("\nEvaluation failed. Do not deploy.")
        sys.exit(1)
    else:
        print("\nEvaluation passed. Safe to deploy.")
        sys.exit(0)


if __name__ == "__main__":
    main()
