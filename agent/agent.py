"""
Edvera Attendance Operations Agent — main entry point.

Built with LangGraph. Two-node graph:
  tools → agent

The tools node gathers data deterministically.
The agent node uses Claude to reason over the data and produce
structured JSON output.
"""

from __future__ import annotations

import json
import os
import operator
from typing import TypedDict, Annotated, Sequence, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END

from agent.tools.context_tools import get_current_user_context
from agent.tools.risk_tools import (
    get_students_at_risk,
    get_student_attendance_summary,
    get_absence_pattern,
    predict_chronic_absenteeism_risk,
)
from agent.tools.compliance_tools import (
    get_compliance_case_status,
    get_open_actions,
    get_tier_requirements,
    check_sarb_eligibility,
    lookup_education_code,
)
from agent.tools.intervention_tools import (
    get_intervention_history,
    recommend_next_action,
)
from agent.tools.brief_tools import generate_school_brief


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class EdveraState(TypedDict):
    user_id: str
    district_id: str
    request_type: str
    request_payload: dict
    messages: Annotated[Sequence[BaseMessage], operator.add]
    tool_results: dict
    final_output: Optional[dict]


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are the Edvera Attendance Operations Agent.
Your job is to assist school staff with attendance compliance \
and intervention planning. You produce structured, accurate, \
actionable recommendations based on real attendance data.

RULES:
1. You never take actions — you only recommend them
2. You never modify data — you only read it
3. Every EC section citation must be verified via lookup_education_code
4. Every recommendation must cite its supporting data
5. You acknowledge uncertainty explicitly when data is incomplete
6. You never cross district boundaries

OUTPUT FORMAT:
Always return valid JSON matching the schema for the request type.
Do not return markdown. Do not return prose explanations.
Return only the structured JSON output schema.

TONE:
State findings factually. Do not use "I think" or "I believe".
Example correct: "Student has 4 unexcused absences, exceeding \
the EC §48260 threshold of 3."
"""


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def tools_node(state: EdveraState) -> dict:
    """Gather data deterministically based on request type."""
    request_type = state["request_type"]
    payload = state["request_payload"]
    user_id = state["user_id"]
    district_id = state["district_id"]
    tool_results: dict = {}

    if request_type == "daily_brief":
        tool_results["brief"] = generate_school_brief(
            school_id=payload["school_id"],
            district_id=district_id,
            user_id=user_id,
        )

    elif request_type == "assess_student":
        student_id = payload["student_id"]
        current_year = os.getenv("CURRENT_SCHOOL_YEAR", "2025-2026")

        tool_results["attendance"] = get_student_attendance_summary(
            student_id=student_id,
            district_id=district_id,
            school_year=current_year,
            user_id=user_id,
        )
        tool_results["patterns"] = get_absence_pattern(
            student_id=student_id,
            district_id=district_id,
            days_back=90,
            user_id=user_id,
        )
        tool_results["risk_projection"] = predict_chronic_absenteeism_risk(
            student_id=student_id,
            district_id=district_id,
            school_year=current_year,
            user_id=user_id,
        )

        case_id = payload.get("case_id")
        if case_id:
            tool_results["compliance"] = get_compliance_case_status(
                case_id=case_id,
                district_id=district_id,
                user_id=user_id,
            )

        tool_results["recommendation"] = recommend_next_action(
            student_id=student_id,
            district_id=district_id,
            user_id=user_id,
            case_id=case_id,
        )

    return {"tool_results": tool_results}


def agent_node(state: EdveraState) -> dict:
    """Use Claude to reason over tool results and produce structured output."""
    llm = ChatAnthropic(
        model=os.getenv("AGENT_MODEL", "claude-sonnet-4-20250514"),
        max_tokens=int(os.getenv("AGENT_MAX_TOKENS", "4096")),
    )

    request_type = state["request_type"]
    payload = state["request_payload"]
    tool_results = state.get("tool_results", {})

    # For daily_brief, the brief is already fully computed — return directly
    if request_type == "daily_brief" and "brief" in tool_results:
        return {
            "final_output": tool_results["brief"],
            "messages": [],
        }

    # Build context message for the LLM
    context = json.dumps(
        {
            "request_type": request_type,
            "payload": payload,
            "tool_results": tool_results,
        },
        indent=2,
        default=str,
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(
            content="Process this request and return structured JSON:\n{}".format(
                context
            )
        ),
    ]

    response = llm.invoke(messages)

    try:
        output = json.loads(response.content)
    except (json.JSONDecodeError, TypeError):
        output = {
            "error": "Agent returned non-JSON response",
            "raw": str(response.content),
        }

    return {
        "final_output": output,
        "messages": messages + [response],
    }


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def construct_graph():
    """Build the two-node LangGraph: tools → agent."""
    g = StateGraph(EdveraState)
    g.add_node("tools", tools_node)
    g.add_node("agent", agent_node)
    g.set_entry_point("tools")
    g.add_edge("tools", "agent")
    g.add_edge("agent", END)
    return g.compile()


# Compile once at module level
graph = construct_graph()


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def run_agent(
    user_id: str,
    district_id: str,
    request_type: str,
    payload: dict,
) -> dict:
    """Run the agent end-to-end.

    Parameters
    ----------
    user_id : str
        Authenticated user UUID.
    district_id : str
        The user's district UUID.
    request_type : str
        One of: "daily_brief", "assess_student".
    payload : dict
        Request-specific parameters (e.g. school_id, student_id).

    Returns
    -------
    dict
        Structured JSON output matching AGENT_SPEC.md schemas.
    """
    result = graph.invoke({
        "user_id": user_id,
        "district_id": district_id,
        "request_type": request_type,
        "request_payload": payload,
        "messages": [],
        "tool_results": {},
        "final_output": None,
    })
    return result["final_output"]
