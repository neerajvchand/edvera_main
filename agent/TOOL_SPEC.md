# Edvera Attendance Operations Agent — Tool Specification

Version: 1.0
Status: Draft
Last updated: March 2026

All tools are read-only. No tool writes to the database.
All tools accept a supabase_client instance injected at runtime.
All tools enforce district_id scoping — never return data outside the authenticated user's district.

---

## CONTEXT TOOLS

These are always called first. No recommendation is made without establishing who is asking and what their scope is.

---

### get_current_user_context

Purpose:
  Establish the authenticated user's identity, role, and district.
  Called at the start of every agent invocation.

Input:
  user_id: str  — UUID from auth.users

Output:
```json
{
  "user_id": "str",
  "display_name": "str",
  "role": "district_admin | principal | attendance_clerk | counselor | read_only",
  "district_id": "str",
  "district_name": "str",
  "school_ids": ["str"]
}
```

Supabase query:
```sql
SELECT
  p.user_id, p.display_name, p.role,
  d.id as district_id, d.name as district_name,
  array_agg(s.id) as school_ids
FROM profiles p
JOIN districts d ON d.id = p.district_id
LEFT JOIN schools s ON s.district_id = d.id
WHERE p.user_id = :user_id
GROUP BY p.user_id, p.display_name, p.role, d.id, d.name
```

Error handling:
  If user not found: raise ToolError("User context not found. Cannot proceed without authenticated user context.")

---

### get_school_context

Purpose:
  Get school details needed for brief generation and document context. Validates the requesting user has access to this school.

Input:
  school_id: str
  district_id: str  — for RLS validation

Output:
```json
{
  "school_id": "str",
  "name": "str",
  "address": "str | null",
  "phone": "str | null",
  "principal_name": "str | null",
  "district_id": "str",
  "district_name": "str",
  "county_office_id": "str | null"
}
```

Supabase query:
```sql
SELECT s.id, s.name, s.address, s.phone, s.principal_name,
       d.id as district_id, d.name as district_name,
       d.county_office_id
FROM schools s
JOIN districts d ON d.id = s.district_id
WHERE s.id = :school_id
AND s.district_id = :district_id
```

Error handling:
  If school not in district: raise ToolError("School not found in district. Access denied.")

---

### get_county_office_context

Purpose:
  Get county SARB coordinator details for brief and recommendations. Used when agent recommends SARB referral — must provide submission contact dynamically, never hardcoded.

Input:
  county_office_id: str

Output:
```json
{
  "name": "str",
  "short_name": "str | null",
  "sarb_coordinator_name": "str | null",
  "sarb_coordinator_email": "str | null",
  "sarb_coordinator_phone": "str | null",
  "sarb_meeting_location": "str | null",
  "sarb_meeting_schedule": "str | null",
  "sarb_referral_instructions": "str | null"
}
```

Supabase query:
```sql
SELECT * FROM county_offices WHERE id = :county_office_id
```

---

## RISK TOOLS

---

### get_students_at_risk

Purpose:
  Core tool for daily brief generation. Returns all students in a school or district who meet any risk threshold. This is the highest-traffic tool — called every morning.

Input:
  district_id: str
  school_id: str | None  — if None, returns district-wide
  risk_bands: list[str]  — filter by band, default all: ["at-risk", "moderate", "severe"]
  include_truancy_threshold: bool  — default True. If True, includes students at exactly 3 unexcused absences even if below 5% chronic threshold.
  limit: int  — default 100, max 500

Output:
  list of:
```json
{
  "student_id": "str",
  "student_name": "str",
  "school_id": "str",
  "school_name": "str",
  "grade": "str",
  "attendance_rate": "float",
  "chronic_band": "satisfactory | at-risk | moderate | severe",
  "unexcused_absences": "int",
  "truancy_count": "int",
  "trend_direction": "improving | declining | stable",
  "trend_delta": "float",
  "active_case_id": "str | null",
  "current_tier": "1 | 2 | 3 | null",
  "days_since_last_action": "int | null"
}
```

Supabase query:
```sql
SELECT
  s.id as student_id,
  s.first_name || ' ' || s.last_name as student_name,
  s.school_id,
  sch.name as school_name,
  s.grade,
  snap.attendance_rate,
  snap.unexcused_absences,
  snap.truancy_count,
  snap.thirty_day_rate,
  snap.prior_thirty_day_rate,
  cc.id as active_case_id,
  cc.current_tier
FROM students s
JOIN schools sch ON sch.id = s.school_id
LEFT JOIN attendance_snapshots snap ON snap.student_id = s.id
  AND snap.school_year = :current_school_year
LEFT JOIN compliance_cases cc ON cc.student_id = s.id
  AND cc.status NOT IN ('resolved', 'closed')
WHERE sch.district_id = :district_id
AND (:school_id IS NULL OR s.school_id = :school_id)
AND (
  snap.attendance_rate < 0.95
  OR snap.unexcused_absences >= 3
)
ORDER BY snap.attendance_rate ASC
LIMIT :limit
```

Post-processing in Python:
  chronic_band = compute_chronic_band(attendance_rate)
  trend_direction = compute_trend(thirty_day_rate, prior_thirty_day_rate)
  trend_delta = thirty_day_rate - prior_thirty_day_rate

---

### get_student_attendance_summary

Purpose:
  Full attendance picture for a single student. Called when assessing an individual student.

Input:
  student_id: str
  district_id: str  — for RLS validation
  school_year: str  — format "2025-2026", default current year

Output:
```json
{
  "student_id": "str",
  "student_name": "str",
  "grade": "str",
  "school_id": "str",
  "school_name": "str",
  "ssid": "str | null",
  "days_enrolled": "int",
  "days_present": "int",
  "total_absences": "int",
  "unexcused_absences": "int",
  "excused_absences": "int",
  "tardies": "int",
  "truancy_count": "int",
  "attendance_rate": "float",
  "chronic_band": "str",
  "thirty_day_rate": "float | null",
  "prior_thirty_day_rate": "float | null",
  "trend_direction": "str"
}
```

Supabase query:
```sql
SELECT
  s.id, s.first_name || ' ' || s.last_name as student_name,
  s.grade, s.school_id, s.ssid,
  sch.name as school_name,
  snap.*
FROM students s
JOIN schools sch ON sch.id = s.school_id
JOIN attendance_snapshots snap ON snap.student_id = s.id
WHERE s.id = :student_id
AND sch.district_id = :district_id
AND snap.school_year = :school_year
```

Error handling:
  If no snapshot found: query attendance_records directly and compute metrics on the fly. Log warning that snapshot is stale.

---

### get_absence_pattern

Purpose:
  Detect patterns in when absences occur — day of week, time of year, clustering. Used by intervention recommendation to suggest targeted interventions.

Input:
  student_id: str
  district_id: str
  days_back: int  — default 90

Output:
```json
{
  "student_id": "str",
  "analysis_period_days": "int",
  "total_absences_in_period": "int",
  "day_of_week_distribution": {
    "monday": "int",
    "tuesday": "int",
    "wednesday": "int",
    "thursday": "int",
    "friday": "int"
  },
  "pattern_detected": "bool",
  "pattern_description": "str | null",
  "streak_detected": "bool",
  "longest_streak_days": "int"
}
```

Supabase query:
```sql
SELECT
  ar.date,
  ar.absence_type,
  EXTRACT(DOW FROM ar.date) as day_of_week
FROM attendance_records ar
JOIN students s ON s.id = ar.student_id
JOIN schools sch ON sch.id = s.school_id
WHERE ar.student_id = :student_id
AND sch.district_id = :district_id
AND ar.date >= CURRENT_DATE - :days_back
AND ar.absence_type IN ('unexcused', 'excused')
ORDER BY ar.date ASC
```

Post-processing in Python:
  Compute day_of_week_distribution from results.
  Detect pattern: if any single day > 40% of absences, flag pattern with description.
  Detect streaks: consecutive absence days >= 3.

---

### predict_chronic_absenteeism_risk

Purpose:
  Project whether student will exceed 10% absence threshold by end of school year based on current trajectory. Used in daily brief to flag students approaching threshold before they cross it — early warning signal.

Input:
  student_id: str
  district_id: str
  school_year: str

Output:
```json
{
  "student_id": "str",
  "current_absence_rate": "float",
  "current_absent_days": "int",
  "days_enrolled": "int",
  "days_remaining_estimate": "int",
  "projected_absence_rate_at_year_end": "float",
  "will_exceed_10_percent": "bool",
  "days_until_threshold": "int | null",
  "confidence": "high | medium | low"
}
```

Computation (Python, no LLM):
```
current_rate = unexcused_absences / days_enrolled
remaining_days = estimated_school_year_days - days_enrolled
projected_absences = unexcused_absences + (current_rate * remaining_days)
projected_rate = projected_absences / (days_enrolled + remaining_days)
days_until_threshold = ceil(
  (0.10 * days_enrolled - unexcused_absences) / current_daily_rate
) if not already exceeded
```

Confidence levels:
  high: 60+ days of data
  medium: 30-59 days of data
  low: under 30 days of data

Note: This tool performs computation — no LLM call inside it. The LLM receives the output and incorporates it into reasoning.

---

## COMPLIANCE TOOLS

---

### get_compliance_case_status

Purpose:
  Full compliance picture for a single case. The agent's primary tool for understanding where a case stands and what is legally required next.

Input:
  case_id: str
  district_id: str

Output:
```json
{
  "case_id": "str",
  "student_id": "str",
  "student_name": "str",
  "school_id": "str",
  "current_tier": "1 | 2 | 3",
  "status": "str",
  "signal_level": "str",
  "opened_at": "str",
  "tier_requirements": {
    "tier1": [
      {
        "key": "str",
        "label": "str",
        "completed": "bool",
        "completed_at": "str | null",
        "source": "str"
      }
    ],
    "tier2": ["..."],
    "tier3": ["..."]
  },
  "tier1_complete": "bool",
  "tier2_complete": "bool",
  "tier3_complete": "bool",
  "sarb_packet_status": "str | null",
  "days_since_opened": "int",
  "overdue_actions_count": "int"
}
```

Supabase query:
```sql
SELECT
  cc.*,
  s.first_name || ' ' || s.last_name as student_name
FROM compliance_cases cc
JOIN students s ON s.id = cc.student_id
JOIN schools sch ON sch.id = cc.school_id
WHERE cc.id = :case_id
AND sch.district_id = :district_id
```

Post-processing:
  Parse tier_requirements JSONB using same logic as getCaseWorkspace.ts tierChecklist computation.
  tier1_complete = all tier1 items completed
  tier2_complete = all tier2 items completed

---

### get_open_actions

Purpose:
  All open, overdue, and blocked actions for a case or school. Used to populate "requires action today" section of brief.

Input:
  district_id: str
  case_id: str | None  — if None, returns all for district
  school_id: str | None
  status_filter: list[str]  — default ["open", "overdue"]
  limit: int  — default 50

Output:
  list of:
```json
{
  "action_id": "str",
  "case_id": "str",
  "student_id": "str",
  "student_name": "str",
  "action_type": "str",
  "title": "str",
  "priority": "urgent | high | medium | low",
  "due_date": "str | null",
  "is_overdue": "bool",
  "days_overdue": "int | null",
  "status": "str",
  "assigned_to_name": "str | null"
}
```

Supabase query:
```sql
SELECT
  a.id as action_id,
  a.compliance_case_id as case_id,
  a.student_id,
  s.first_name || ' ' || s.last_name as student_name,
  a.type as action_type,
  a.title,
  a.priority,
  a.due_date,
  a.status,
  p.display_name as assigned_to_name,
  CASE
    WHEN a.due_date < CURRENT_DATE AND a.status != 'completed'
    THEN TRUE ELSE FALSE
  END as is_overdue,
  CASE
    WHEN a.due_date < CURRENT_DATE
    THEN CURRENT_DATE - a.due_date::date
    ELSE NULL
  END as days_overdue
FROM actions a
JOIN students s ON s.id = a.student_id
JOIN schools sch ON sch.id = s.school_id
LEFT JOIN profiles p ON p.user_id = a.assigned_to
WHERE sch.district_id = :district_id
AND (:case_id IS NULL OR a.compliance_case_id = :case_id)
AND (:school_id IS NULL OR s.school_id = :school_id)
AND a.status = ANY(:status_filter)
ORDER BY a.priority DESC, a.due_date ASC
LIMIT :limit
```

---

### get_tier_requirements

Purpose:
  Read the tier_requirements JSONB for a case and return structured state. Simpler than get_compliance_case_status when only checklist state is needed.

Input:
  case_id: str
  district_id: str

Output:
```json
{
  "case_id": "str",
  "tier_requirements_raw": "dict",
  "notification_sent": "bool",
  "legal_language": "bool",
  "conference_held": "bool",
  "resources_offered": "bool",
  "consequences_explained": "bool",
  "packet_assembled": "bool",
  "prior_tiers_documented": "bool",
  "referral_submitted": "bool",
  "tier1_complete": "bool",
  "tier2_complete": "bool",
  "tier3_complete": "bool"
}
```

---

### check_sarb_eligibility

Purpose:
  Determine whether a student is legally eligible for SARB referral per EC §48263. Returns eligibility with specific legal basis and what is missing if not yet eligible.

Input:
  student_id: str
  case_id: str
  district_id: str

Output:
```json
{
  "student_id": "str",
  "case_id": "str",
  "sarb_eligible": "bool",
  "eligibility_basis": "str | null",
  "ec_citation": "EC §48263",
  "blocking_reasons": ["str"],
  "tier1_complete": "bool",
  "tier2_complete": "bool",
  "truancy_count": "int",
  "attendance_rate": "float",
  "recommendation": "str"
}
```

Logic:
```
sarb_eligible = (
  (truancy_count >= 3 AND tier1_complete AND tier2_complete)
  OR (attendance_rate <= 0.90 AND tier1_complete AND tier2_complete)
)
```

If not eligible, blocking_reasons lists specifically what is missing — e.g. "Tier 2 conference has not been held or attempted per EC §48262"

---

### lookup_education_code

Purpose:
  Return the plain language summary and statutory basis for an EC section. Used when the agent cites a section in its output — verifies the citation is accurate.

Input:
  section: str  — e.g. "48260" or "48263"

Output:
```json
{
  "section": "str",
  "citation": "str",
  "title": "str",
  "effective_date": "str",
  "summary": "str",
  "tags": ["str"],
  "used_in": ["str"]
}
```

Data source:
  Static data — reads from ec_sections.py which mirrors educationCodeSections.ts. Same content, Python format.
  No database query. No LLM call.
  If section not found: return None and log warning.

Note: This tool exists so the agent always cites real sections. The LLM cannot hallucinate an EC section if it must call this tool and get a real result before citing.

---

## INTERVENTION TOOLS

---

### get_intervention_history

Purpose:
  All interventions logged for a student. Used to understand what has already been tried before recommending next action.

Input:
  student_id: str
  district_id: str
  limit: int  — default 20

Output:
  list of:
```json
{
  "intervention_id": "str",
  "intervention_type": "str",
  "date": "str",
  "description": "str | null",
  "outcome": "str | null",
  "logged_by": "str | null"
}
```

Supabase query:
```sql
SELECT
  il.id as intervention_id,
  il.type as intervention_type,
  il.date,
  il.description,
  il.outcome,
  p.display_name as logged_by
FROM intervention_log il
JOIN students s ON s.id = il.student_id
JOIN schools sch ON sch.id = s.school_id
LEFT JOIN profiles p ON p.user_id = il.logged_by
WHERE il.student_id = :student_id
AND sch.district_id = :district_id
ORDER BY il.date DESC
LIMIT :limit
```

---

### recommend_next_action

Purpose:
  Synthesize attendance data, compliance state, and intervention history into a single recommended next action. This is the agent's primary reasoning output for an individual student.

Input:
  student_id: str
  case_id: str | None
  district_id: str

Output:
```json
{
  "student_id": "str",
  "recommended_action": "str",
  "action_type": "truancy_letter | follow_up_call | conference | sarb_referral | counselor_referral | monitor | close_case",
  "urgency": "routine | elevated | urgent",
  "rationale": "str",
  "ec_citation": "str | null",
  "supporting_data": {
    "attendance_rate": "float",
    "unexcused_absences": "int",
    "truancy_count": "int",
    "tier1_complete": "bool",
    "tier2_complete": "bool",
    "last_intervention": "str | null"
  },
  "blocked_by": "str | null"
}
```

Logic (deterministic, computed before LLM reasoning):
  This tool applies the EC compliance ladder in order.
  The LLM uses this output to construct the recommendation narrative — it does not override the logic.

```
if not active_case and unexcused_absences >= 3:
  → truancy_letter, urgent, EC §48260

if active_case and tier1_complete and not tier2_complete:
  → conference, elevated, EC §48262

if active_case and tier1_complete and tier2_complete and not sarb_eligible:
  → monitor or follow_up_call, routine

if sarb_eligible and not tier3_complete:
  → sarb_referral, urgent, EC §48263

if attendance_rate < 0.80:
  → counselor_referral regardless of tier state, urgent
```

---

## BRIEF TOOLS

---

### generate_school_brief

Purpose:
  Orchestrates all other tools to produce the daily school brief. This is the highest-level tool — calls risk tools, compliance tools, and assembles the output schema defined in AGENT_SPEC.md section 7.

Input:
  school_id: str
  district_id: str
  date: str  — ISO date, default today

Output:
  Daily brief output shape as defined in AGENT_SPEC.md section 7.

Implementation:
  1. get_school_context(school_id, district_id)
  2. get_students_at_risk(district_id, school_id)
  3. For each at-risk student: recommend_next_action
  4. get_open_actions(district_id, school_id=school_id)
  5. Query compliance_cases for requires_approval items
  6. Assemble into output schema
  7. Return structured JSON

This tool does NOT call the LLM.
It computes the brief deterministically from tool outputs.
The LLM receives the brief JSON and can generate a natural language summary if the UI requests one.

---

### generate_district_brief

Purpose:
  District-level brief. Aggregates school briefs and adds district-level compliance and funding signals.
  Phase 2 — defined here for specification completeness.

Input:
  district_id: str
  date: str

Output:
  Extended daily brief with school-level breakdown.
  Defined fully in Phase 2 specification.

---

## Tool Error Handling

Every tool follows this error contract:

```python
class ToolError(Exception):
    def __init__(self, message: str, tool_name: str, recoverable: bool = True):
        self.tool_name = tool_name
        self.recoverable = recoverable
        super().__init__(message)
```

Recoverable errors:
  Missing optional data — tool returns partial result with explicit null fields and a warning flag.

Non-recoverable errors:
  District boundary violation — raise immediately, agent stops and returns safety error to caller.
  User context not found — raise immediately.

The agent never suppresses tool errors silently.
Every error is logged to agent_logs before propagation.

---

## Tool Execution Rules

1. Tools are called in the minimum number needed to answer the question. No speculative tool calls.
2. get_current_user_context is always called first.
3. lookup_education_code is called before any EC section is included in agent output — never cite from memory.
4. Tools that query attendance data always receive district_id for RLS validation even if Supabase RLS would catch it — defense in depth.
5. No tool makes an LLM call internally. Tools are pure data retrieval and deterministic computation. The LLM reasons over tool outputs, not inside them.
6. All tool calls are logged with inputs, outputs summary, and latency before the agent returns its response.
