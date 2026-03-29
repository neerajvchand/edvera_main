from __future__ import annotations

import json
import datetime
from typing import Optional


def log_tool_call(
    client: Client,
    user_id: str,
    district_id: str,
    tool_name: str,
    inputs_summary: dict,
    output_summary: str,
    latency_ms: int,
    error: str | None = None,
) -> None:
    try:
        client.table("agent_logs").insert(
            {
                "user_id": user_id,
                "district_id": district_id,
                "tool_name": tool_name,
                "inputs_summary": json.dumps(inputs_summary),
                "output_summary": output_summary,
                "latency_ms": latency_ms,
                "error": error,
                "created_at": datetime.datetime.utcnow().isoformat(),
            }
        ).execute()
    except Exception as e:
        # Logging must never crash the agent
        print(f"[WARN] Failed to log tool call {tool_name}: {e}")
