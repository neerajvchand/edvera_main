# Edvera Attendance Operations Agent

## Overview

Python agent service for the Edvera console.
Reads attendance and compliance data from Supabase.
Produces structured operational recommendations for school staff.

## Stack

- Python 3.11+
- LangGraph for agent orchestration
- Anthropic Claude claude-sonnet-4-20250514 as the LLM
- Supabase Python client for database access
- FastAPI for HTTP API

## Setup

1. Copy .env.example to .env and fill in values
2. Create virtual environment: python -m venv venv
3. Activate: source venv/bin/activate
4. Install: pip install -r requirements.txt
5. Run: uvicorn api.main:app --reload

## Architecture

See AGENT_SPEC.md for behavioral specification.
See TOOL_SPEC.md for tool definitions.
See evaluation/scenarios/ for test suite.

## Directory Structure

```
agent/
  tools/           — tool functions (read-only Supabase access)
  evaluation/      — judge and test harness
  api/             — FastAPI endpoints
  lib/             — shared utilities
  tests/           — pytest test suite
```

## Running Evaluations

```
pytest tests/evaluation/
```

## Coding Standards

- All tools are read-only — no writes to database
- All tools accept district_id for RLS validation
- No tool calls the LLM internally
- Every tool call is logged before return
- Service role key used server-side only — never exposed to browser
