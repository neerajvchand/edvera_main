"""
FastAPI wrapper for the Edvera Attendance Operations Agent.

Endpoints:
  GET  /health              — no auth
  POST /agent/daily-brief   — API key required
  POST /agent/assess-student — API key required
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional

from agent.agent import run_agent


app = FastAPI(
    title="Edvera Attendance Operations Agent",
    version="1.0.0",
)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class DailyBriefRequest(BaseModel):
    user_id: str
    district_id: str
    school_id: str
    date: Optional[str] = None


class AssessStudentRequest(BaseModel):
    user_id: str
    district_id: str
    student_id: str
    case_id: Optional[str] = None


class AgentResponse(BaseModel):
    success: bool
    data: dict
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def verify_api_key(x_api_key: str = Header(...)):
    expected = os.getenv("API_SECRET_KEY")
    if not expected or x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/agent/daily-brief", response_model=AgentResponse)
def daily_brief(
    request: DailyBriefRequest,
    api_key: str = Depends(verify_api_key),
):
    try:
        result = run_agent(
            user_id=request.user_id,
            district_id=request.district_id,
            request_type="daily_brief",
            payload={
                "school_id": request.school_id,
                "date": request.date,
            },
        )
        return AgentResponse(success=True, data=result or {})
    except Exception as e:
        return AgentResponse(success=False, data={}, error=str(e))


@app.post("/agent/assess-student", response_model=AgentResponse)
def assess_student(
    request: AssessStudentRequest,
    api_key: str = Depends(verify_api_key),
):
    try:
        result = run_agent(
            user_id=request.user_id,
            district_id=request.district_id,
            request_type="assess_student",
            payload={
                "student_id": request.student_id,
                "case_id": request.case_id,
            },
        )
        return AgentResponse(success=True, data=result or {})
    except Exception as e:
        return AgentResponse(success=False, data={}, error=str(e))
