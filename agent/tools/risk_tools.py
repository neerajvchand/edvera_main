"""
Risk tools — attendance data, absence patterns, and chronic risk projection.
All read-only. All district-scoped.
"""

from __future__ import annotations

import os
import time
import datetime
from math import ceil
from typing import Optional

from agent.lib.supabase_client import get_supabase_client
from agent.lib.logging import log_tool_call
from agent.lib.tool_error import ToolError, DistrictBoundaryViolation


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Approximate CA school break windows for 2025-2026.
# Used by pattern detection when school_calendars data is unavailable.
_BREAK_WINDOWS: list[dict] = [
    {
        "name": "Thanksgiving",
        "start": datetime.date(2025, 11, 24),
        "end": datetime.date(2025, 11, 28),
        "last_school_day_before": datetime.date(2025, 11, 21),
    },
    {
        "name": "Winter",
        "start": datetime.date(2025, 12, 22),
        "end": datetime.date(2026, 1, 2),
        "last_school_day_before": datetime.date(2025, 12, 19),
    },
    {
        "name": "Spring",
        "start": datetime.date(2026, 3, 23),
        "end": datetime.date(2026, 3, 27),
        "last_school_day_before": datetime.date(2026, 3, 20),
    },
]

# Canonical absence types that count as absent
_ABSENT_TYPES = [
    "absent_unverified",
    "absent_excused",
    "absent_unexcused",
]

_UNEXCUSED_TYPES = [
    "absent_unverified",
    "absent_unexcused",
]

_TARDY_TYPES = [
    "tardy",
    "tardy_excused",
    "tardy_unexcused",
]

_TIER_MAP = {
    "none": None,
    "tier_1_letter": 1,
    "tier_2_conference": 2,
    "tier_3_sarb_referral": 3,
}

_DOW_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday"]


# ---------------------------------------------------------------------------
# Helpers — exported for testing
# ---------------------------------------------------------------------------

def compute_chronic_band(rate: Optional[float]) -> str:
    """Classify attendance rate into chronic band.

    ``rate`` is a decimal 0-1, e.g. 0.95 = 95 %.
    """
    if rate is None:
        return "satisfactory"
    if rate >= 0.95:
        return "satisfactory"
    if rate >= 0.90:
        return "at-risk"
    if rate >= 0.80:
        return "moderate"
    return "severe"


def compute_trend(
    thirty_day: Optional[float],
    prior_thirty_day: Optional[float],
) -> str:
    """Determine trend direction from two 30-day rate windows (decimal 0-1)."""
    if thirty_day is None or prior_thirty_day is None:
        return "stable"
    delta = thirty_day - prior_thirty_day
    if delta > 0.02:
        return "improving"
    if delta < -0.02:
        return "declining"
    return "stable"


def _parse_tier(tier_str: Optional[str]) -> Optional[int]:
    """Convert compliance_tier enum string to integer 1/2/3 or None."""
    if not tier_str:
        return None
    return _TIER_MAP.get(tier_str)


def _rate_to_decimal(val: Optional[float]) -> Optional[float]:
    """Convert a rate stored as 0-100 percentage to 0-1 decimal."""
    if val is None:
        return None
    return round(val / 100.0, 4)


def _parse_date(d) -> Optional[datetime.date]:
    """Parse a date string (ISO) or date object."""
    if d is None:
        return None
    if isinstance(d, datetime.date):
        return d
    try:
        return datetime.date.fromisoformat(str(d)[:10])
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Pattern detection — pure Python, no DB, no LLM
# ---------------------------------------------------------------------------

def _detect_patterns(
    absences: list[dict],
    tardies: list[str],
    break_windows: Optional[list[dict]] = None,
) -> dict:
    """Detect six absence/tardy patterns.

    Parameters
    ----------
    absences : list[dict]
        Each dict has ``date`` (ISO str) and ``absence_type`` (str).
    tardies : list[str]
        ISO date strings of tardy days.
    break_windows : list[dict] | None
        Override default break windows for testing.

    Returns
    -------
    dict with patterns_detected, dominant_pattern,
    tardy_escalation_detected, total_absences_in_period,
    analysis_period_days.
    """
    breaks = break_windows if break_windows is not None else _BREAK_WINDOWS
    patterns: list[dict] = []

    # Parse absence dates
    absence_dates: list[datetime.date] = sorted(
        d for d in (_parse_date(a["date"]) for a in absences) if d is not None
    )
    tardy_dates: list[datetime.date] = sorted(
        d for d in (_parse_date(t) for t in tardies) if d is not None
    )

    total_absences = len(absence_dates)
    if absence_dates:
        span = (absence_dates[-1] - absence_dates[0]).days + 1
    else:
        span = 0

    # ---- 1. absence_streak: 3+ consecutive school days absent ----
    longest_streak = 0
    longest_streak_start: Optional[datetime.date] = None
    if absence_dates:
        streak = 1
        streak_start = absence_dates[0]
        for i in range(1, len(absence_dates)):
            gap = (absence_dates[i] - absence_dates[i - 1]).days
            # Consecutive school day: next day (1) or over weekend (2-3)
            if gap <= 3:
                streak += 1
            else:
                if streak > longest_streak:
                    longest_streak = streak
                    longest_streak_start = streak_start
                streak = 1
                streak_start = absence_dates[i]
        if streak > longest_streak:
            longest_streak = streak
            longest_streak_start = streak_start

    if longest_streak >= 3:
        patterns.append({
            "pattern": "absence_streak",
            "occurrences": 1,
            "last_seen": longest_streak_start.isoformat() if longest_streak_start else None,
            "detail": {
                "longest_streak_days": longest_streak,
                "streak_start": longest_streak_start.isoformat() if longest_streak_start else None,
            },
        })

    # ---- 2. extended_weekend: Fri+Mon or Thu+Fri ----
    ext_weekend_count = 0
    last_ext_weekend: Optional[datetime.date] = None
    absence_set = set(absence_dates)
    for d in absence_dates:
        dow = d.weekday()  # 0=Mon … 4=Fri
        if dow == 4:  # Friday
            next_mon = d + datetime.timedelta(days=3)
            if next_mon in absence_set:
                ext_weekend_count += 1
                last_ext_weekend = next_mon
        if dow == 3:  # Thursday
            next_fri = d + datetime.timedelta(days=1)
            if next_fri in absence_set:
                ext_weekend_count += 1
                last_ext_weekend = next_fri

    if ext_weekend_count > 0:
        patterns.append({
            "pattern": "extended_weekend",
            "occurrences": ext_weekend_count,
            "last_seen": last_ext_weekend.isoformat() if last_ext_weekend else None,
            "detail": {"count": ext_weekend_count},
        })

    # ---- 3. recurring_weekly_absence: 1+ per week for 4+ consecutive weeks ----
    if absence_dates:
        # Group by ISO week
        weeks: dict[tuple[int, int], int] = {}
        for d in absence_dates:
            iso = d.isocalendar()
            key = (iso[0], iso[1])  # (year, week)
            weeks[key] = weeks.get(key, 0) + 1

        sorted_weeks = sorted(weeks.keys())
        best_run = 0
        run = 1
        run_start = 0
        for i in range(1, len(sorted_weeks)):
            prev_y, prev_w = sorted_weeks[i - 1]
            cur_y, cur_w = sorted_weeks[i]
            # Check if weeks are consecutive
            expected_next = datetime.date.fromisocalendar(prev_y, prev_w, 1) + datetime.timedelta(weeks=1)
            actual = datetime.date.fromisocalendar(cur_y, cur_w, 1)
            if expected_next == actual:
                run += 1
            else:
                if run > best_run:
                    best_run = run
                    run_start = i - run
                run = 1
        if run > best_run:
            best_run = run

        if best_run >= 4:
            # Find most common day of week
            dow_counts = [0] * 5
            for d in absence_dates:
                if d.weekday() < 5:
                    dow_counts[d.weekday()] += 1
            most_common_idx = dow_counts.index(max(dow_counts))

            patterns.append({
                "pattern": "recurring_weekly_absence",
                "occurrences": best_run,
                "last_seen": absence_dates[-1].isoformat(),
                "detail": {
                    "weeks_consecutive": best_run,
                    "most_common_day": _DOW_NAMES[most_common_idx],
                },
            })

    # ---- 4. tardy_cluster: 5+ tardies in last 10 school days ----
    tardy_escalation = False
    if tardy_dates:
        recent_tardies = tardy_dates[-10:]  # last 10 tardy records
        # Count tardies within a 14-calendar-day window (≈10 school days)
        if len(tardy_dates) >= 5:
            window_start = tardy_dates[-1] - datetime.timedelta(days=14)
            in_window = [t for t in tardy_dates if t >= window_start]
            if len(in_window) >= 5:
                tardy_escalation = True
                patterns.append({
                    "pattern": "tardy_cluster",
                    "occurrences": len(in_window),
                    "last_seen": tardy_dates[-1].isoformat(),
                    "detail": {
                        "count": len(in_window),
                        "window_start": window_start.isoformat(),
                        "window_end": tardy_dates[-1].isoformat(),
                    },
                })

    # ---- 5. post_holiday_cluster: absence within 3 school days after break ----
    post_holiday_hits: list[str] = []
    for brk in breaks:
        end_date = brk["end"]
        window_end = end_date + datetime.timedelta(days=5)  # ~3 school days
        for d in absence_dates:
            if end_date < d <= window_end:
                post_holiday_hits.append(brk["name"])
                break

    if post_holiday_hits:
        patterns.append({
            "pattern": "post_holiday_cluster",
            "occurrences": len(post_holiday_hits),
            "last_seen": None,
            "detail": {"holidays": post_holiday_hits},
        })

    # ---- 6. pre_vacation_absence: absent on last school day before break ----
    pre_vacation_hits: list[str] = []
    for brk in breaks:
        last_day = brk["last_school_day_before"]
        if last_day in absence_set:
            pre_vacation_hits.append(brk["name"])

    if pre_vacation_hits:
        patterns.append({
            "pattern": "pre_vacation_absence",
            "occurrences": len(pre_vacation_hits),
            "last_seen": None,
            "detail": {"breaks": pre_vacation_hits},
        })

    # Determine dominant pattern (most occurrences)
    dominant: Optional[str] = None
    if patterns:
        dominant = max(patterns, key=lambda p: p["occurrences"])["pattern"]

    return {
        "patterns_detected": patterns,
        "dominant_pattern": dominant,
        "tardy_escalation_detected": tardy_escalation,
        "total_absences_in_period": total_absences,
        "analysis_period_days": span,
    }


# ---------------------------------------------------------------------------
# Chronic risk projection — pure Python, no LLM
# ---------------------------------------------------------------------------

def _project_chronic_risk(
    unexcused_absences: int,
    days_enrolled: int,
    school_year_total_days: int = 180,
) -> dict:
    """Project whether student will cross 10 % absence threshold by year end.

    All computation — no LLM call.
    """
    if days_enrolled <= 0:
        return {
            "current_absence_rate": 0.0,
            "current_absent_days": unexcused_absences,
            "days_enrolled": days_enrolled,
            "days_remaining_estimate": school_year_total_days,
            "projected_absence_rate_at_year_end": 0.0,
            "will_exceed_10_percent": False,
            "days_until_threshold": None,
            "confidence": "low",
        }

    current_rate = unexcused_absences / days_enrolled
    remaining_days = max(school_year_total_days - days_enrolled, 0)
    projected_absences = unexcused_absences + (current_rate * remaining_days)
    total_days = days_enrolled + remaining_days
    projected_rate = projected_absences / total_days if total_days > 0 else 0.0

    will_exceed = projected_rate >= 0.10

    # Days until 10 % threshold is crossed
    days_until: Optional[int] = None
    threshold_absences = 0.10 * days_enrolled
    if unexcused_absences < threshold_absences and current_rate > 0:
        days_until = ceil(
            (threshold_absences - unexcused_absences) / current_rate
        )
    elif unexcused_absences >= threshold_absences:
        days_until = 0  # already exceeded

    # Confidence based on data volume
    if days_enrolled >= 60:
        confidence = "high"
    elif days_enrolled >= 30:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "current_absence_rate": round(current_rate, 4),
        "current_absent_days": unexcused_absences,
        "days_enrolled": days_enrolled,
        "days_remaining_estimate": remaining_days,
        "projected_absence_rate_at_year_end": round(projected_rate, 4),
        "will_exceed_10_percent": will_exceed,
        "days_until_threshold": days_until,
        "confidence": confidence,
    }


# ===================================================================
# PUBLIC TOOL FUNCTIONS
# ===================================================================


def get_students_at_risk(
    district_id: str,
    school_id: Optional[str] = None,
    risk_bands: Optional[list[str]] = None,
    include_truancy_threshold: bool = True,
    limit: int = 100,
    user_id: str = "",
) -> list[dict]:
    """Return students meeting any risk threshold for a school or district."""
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[list] = None

    try:
        current_year = os.getenv("CURRENT_SCHOOL_YEAR", "2025-2026")
        if risk_bands is None:
            risk_bands = ["at-risk", "moderate", "severe"]
        limit = min(limit, 500)

        # 1. Schools in scope
        if school_id:
            school_ids = [school_id]
        else:
            schools_resp = (
                client.table("schools")
                .select("id")
                .eq("district_id", district_id)
                .execute()
            )
            school_ids = [s["id"] for s in (schools_resp.data or [])]

        if not school_ids:
            result = []
            return result

        # 2. At-risk snapshots (attendance_rate stored as 0-100)
        snap_query = (
            client.table("attendance_snapshots")
            .select(
                "student_id, school_id, attendance_rate, "
                "days_absent_unexcused, days_truant, "
                "days_enrolled, days_present, days_absent"
            )
            .eq("academic_year", current_year)
            .in_("school_id", school_ids)
            .or_("attendance_rate.lt.95,days_absent_unexcused.gte.3")
            .order("attendance_rate")
            .limit(limit)
        )
        snapshots = snap_query.execute().data or []

        if not snapshots:
            result = []
            return result

        student_ids = list(set(s["student_id"] for s in snapshots))

        # 3. Student details
        student_resp = (
            client.table("students")
            .select("id, first_name, last_name, grade_level, school_id")
            .in_("id", student_ids)
            .execute()
        )
        student_map = {s["id"]: s for s in (student_resp.data or [])}

        # 4. School names
        school_resp = (
            client.table("schools")
            .select("id, name")
            .in_("id", school_ids)
            .execute()
        )
        school_map = {s["id"]: s["name"] for s in (school_resp.data or [])}

        # 5. Active compliance cases
        cases_resp = (
            client.table("compliance_cases")
            .select("id, student_id, current_tier")
            .in_("student_id", student_ids)
            .eq("is_resolved", False)
            .execute()
        )
        case_map = {c["student_id"]: c for c in (cases_resp.data or [])}

        # 6. Risk signals for trend data
        signals_resp = (
            client.table("risk_signals")
            .select("student_id, last_30_rate, previous_30_rate")
            .in_("student_id", student_ids)
            .execute()
        )
        signal_map = {s["student_id"]: s for s in (signals_resp.data or [])}

        # Assemble
        result = []
        for snap in snapshots:
            sid = snap["student_id"]
            student = student_map.get(sid)
            if not student:
                continue

            rate_dec = _rate_to_decimal(snap.get("attendance_rate"))
            band = compute_chronic_band(rate_dec)

            # Filter by requested bands
            if band == "satisfactory":
                unex = snap.get("days_absent_unexcused", 0) or 0
                if not (include_truancy_threshold and unex >= 3):
                    continue
            elif band not in risk_bands:
                continue

            sig = signal_map.get(sid, {})
            thirty = _rate_to_decimal(sig.get("last_30_rate"))
            prior = _rate_to_decimal(sig.get("previous_30_rate"))
            trend = compute_trend(thirty, prior)
            delta = round(thirty - prior, 4) if thirty is not None and prior is not None else 0.0

            case = case_map.get(sid)
            tier = _parse_tier(case["current_tier"]) if case else None

            result.append({
                "student_id": sid,
                "student_name": "{} {}".format(
                    student.get("first_name", ""),
                    student.get("last_name", ""),
                ),
                "school_id": student["school_id"],
                "school_name": school_map.get(student["school_id"], ""),
                "grade": student.get("grade_level", ""),
                "attendance_rate": rate_dec,
                "chronic_band": band,
                "unexcused_absences": snap.get("days_absent_unexcused", 0) or 0,
                "truancy_count": snap.get("days_truant", 0) or 0,
                "trend_direction": trend,
                "trend_delta": delta,
                "active_case_id": case["id"] if case else None,
                "current_tier": tier,
                "days_since_last_action": None,
            })

        return result

    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_students_at_risk")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="get_students_at_risk",
            inputs_summary={
                "district_id": district_id,
                "school_id": school_id,
                "limit": limit,
            },
            output_summary="{} students".format(len(result) if result else 0),
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# get_student_attendance_summary
# ---------------------------------------------------------------------------

def get_student_attendance_summary(
    student_id: str,
    district_id: str,
    school_year: Optional[str] = None,
    user_id: str = "",
) -> dict:
    """Full attendance picture for a single student."""
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        current_year = school_year or os.getenv("CURRENT_SCHOOL_YEAR", "2025-2026")

        # Student + district validation
        student_resp = (
            client.table("students")
            .select(
                "id, first_name, last_name, grade_level, "
                "school_id, state_student_id, district_id"
            )
            .eq("id", student_id)
            .execute()
        )
        if not student_resp.data:
            raise ToolError("Student not found.", "get_student_attendance_summary")

        student = student_resp.data[0]
        if student.get("district_id") != district_id:
            raise DistrictBoundaryViolation("get_student_attendance_summary")

        # School name
        school_resp = (
            client.table("schools")
            .select("id, name")
            .eq("id", student["school_id"])
            .single()
            .execute()
        )
        school_name = school_resp.data["name"] if school_resp.data else ""

        # Snapshot
        snap_resp = (
            client.table("attendance_snapshots")
            .select("*")
            .eq("student_id", student_id)
            .eq("academic_year", current_year)
            .execute()
        )

        if snap_resp.data:
            snap = snap_resp.data[0]
        else:
            # No snapshot — return empty metrics with warning
            snap = {}

        # Risk signals for trend data
        sig_resp = (
            client.table("risk_signals")
            .select("last_30_rate, previous_30_rate")
            .eq("student_id", student_id)
            .execute()
        )
        sig = sig_resp.data[0] if sig_resp.data else {}

        thirty = _rate_to_decimal(sig.get("last_30_rate"))
        prior = _rate_to_decimal(sig.get("previous_30_rate"))
        rate_dec = _rate_to_decimal(snap.get("attendance_rate"))

        result = {
            "student_id": student_id,
            "student_name": "{} {}".format(
                student.get("first_name", ""),
                student.get("last_name", ""),
            ),
            "grade": student.get("grade_level", ""),
            "school_id": student["school_id"],
            "school_name": school_name,
            "ssid": student.get("state_student_id"),
            "days_enrolled": snap.get("days_enrolled", 0) or 0,
            "days_present": snap.get("days_present", 0) or 0,
            "total_absences": snap.get("days_absent", 0) or 0,
            "unexcused_absences": snap.get("days_absent_unexcused", 0) or 0,
            "excused_absences": snap.get("days_absent_excused", 0) or 0,
            "tardies": snap.get("days_tardy", 0) or 0,
            "truancy_count": snap.get("days_truant", 0) or 0,
            "attendance_rate": rate_dec,
            "chronic_band": compute_chronic_band(rate_dec),
            "thirty_day_rate": thirty,
            "prior_thirty_day_rate": prior,
            "trend_direction": compute_trend(thirty, prior),
        }
        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_student_attendance_summary")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="get_student_attendance_summary",
            inputs_summary={"student_id": student_id},
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# get_absence_pattern
# ---------------------------------------------------------------------------

def get_absence_pattern(
    student_id: str,
    district_id: str,
    days_back: int = 90,
    user_id: str = "",
) -> dict:
    """Detect absence and tardy patterns for a student.

    Queries attendance_daily for the last ``days_back`` calendar days.
    Runs six pattern detections (pure Python).
    """
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        # District validation via student
        student_resp = (
            client.table("students")
            .select("id, district_id")
            .eq("id", student_id)
            .execute()
        )
        if not student_resp.data:
            raise ToolError("Student not found.", "get_absence_pattern")
        if student_resp.data[0].get("district_id") != district_id:
            raise DistrictBoundaryViolation("get_absence_pattern")

        cutoff = (
            datetime.date.today() - datetime.timedelta(days=days_back)
        ).isoformat()

        # Absences
        abs_resp = (
            client.table("attendance_daily")
            .select("calendar_date, canonical_type")
            .eq("student_id", student_id)
            .gte("calendar_date", cutoff)
            .in_("canonical_type", _ABSENT_TYPES)
            .order("calendar_date")
            .execute()
        )
        raw_absences = abs_resp.data or []
        absences = [
            {
                "date": r["calendar_date"],
                "absence_type": (
                    "unexcused"
                    if r["canonical_type"] in _UNEXCUSED_TYPES
                    else "excused"
                ),
            }
            for r in raw_absences
        ]

        # Tardies
        tardy_resp = (
            client.table("attendance_daily")
            .select("calendar_date")
            .eq("student_id", student_id)
            .gte("calendar_date", cutoff)
            .in_("canonical_type", _TARDY_TYPES)
            .order("calendar_date")
            .execute()
        )
        tardies = [r["calendar_date"] for r in (tardy_resp.data or [])]

        # Run pattern detection
        pattern_result = _detect_patterns(absences, tardies)

        # Day-of-week distribution
        dow_dist = {name: 0 for name in _DOW_NAMES}
        for a in absences:
            d = _parse_date(a["date"])
            if d and d.weekday() < 5:
                dow_dist[_DOW_NAMES[d.weekday()]] += 1

        # Dominant single day (>40 % of absences)
        total = len(absences)
        pattern_desc: Optional[str] = None
        pattern_detected = False
        if total > 0:
            max_day = max(dow_dist, key=lambda k: dow_dist[k])
            if dow_dist[max_day] / total > 0.40:
                pattern_detected = True
                pattern_desc = "Absences concentrated on {}s ({}/{})".format(
                    max_day.capitalize(), dow_dist[max_day], total
                )

        if pattern_result["patterns_detected"]:
            pattern_detected = True
            if not pattern_desc:
                pattern_desc = pattern_result["dominant_pattern"]

        # Streak info from pattern result
        streak_detected = False
        longest_streak = 0
        for p in pattern_result["patterns_detected"]:
            if p["pattern"] == "absence_streak":
                streak_detected = True
                longest_streak = p["detail"]["longest_streak_days"]

        result = {
            "student_id": student_id,
            "analysis_period_days": days_back,
            "total_absences_in_period": total,
            "day_of_week_distribution": dow_dist,
            "pattern_detected": pattern_detected,
            "pattern_description": pattern_desc,
            "streak_detected": streak_detected,
            "longest_streak_days": longest_streak,
            # Extended pattern detail
            "patterns_detected": pattern_result["patterns_detected"],
            "dominant_pattern": pattern_result["dominant_pattern"],
            "tardy_escalation_detected": pattern_result["tardy_escalation_detected"],
        }
        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "get_absence_pattern")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="get_absence_pattern",
            inputs_summary={
                "student_id": student_id,
                "days_back": days_back,
            },
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# predict_chronic_absenteeism_risk
# ---------------------------------------------------------------------------

def predict_chronic_absenteeism_risk(
    student_id: str,
    district_id: str,
    school_year: Optional[str] = None,
    user_id: str = "",
) -> dict:
    """Project whether student will exceed 10 % absence threshold.

    Pure computation — no LLM call.
    """
    client = get_supabase_client()
    start = time.time()
    error_msg: Optional[str] = None
    result: Optional[dict] = None

    try:
        current_year = school_year or os.getenv("CURRENT_SCHOOL_YEAR", "2025-2026")
        total_days = int(os.getenv("SCHOOL_YEAR_TOTAL_DAYS", "180"))

        # District validation
        student_resp = (
            client.table("students")
            .select("id, district_id")
            .eq("id", student_id)
            .execute()
        )
        if not student_resp.data:
            raise ToolError("Student not found.", "predict_chronic_absenteeism_risk")
        if student_resp.data[0].get("district_id") != district_id:
            raise DistrictBoundaryViolation("predict_chronic_absenteeism_risk")

        # Snapshot
        snap_resp = (
            client.table("attendance_snapshots")
            .select("days_enrolled, days_absent_unexcused")
            .eq("student_id", student_id)
            .eq("academic_year", current_year)
            .execute()
        )

        if snap_resp.data:
            snap = snap_resp.data[0]
            days_enrolled = snap.get("days_enrolled", 0) or 0
            unexcused = snap.get("days_absent_unexcused", 0) or 0
        else:
            days_enrolled = 0
            unexcused = 0

        projection = _project_chronic_risk(
            unexcused_absences=unexcused,
            days_enrolled=days_enrolled,
            school_year_total_days=total_days,
        )

        result = {"student_id": student_id, **projection}
        return result

    except (ToolError, DistrictBoundaryViolation):
        raise
    except Exception as e:
        error_msg = str(e)
        raise ToolError(str(e), "predict_chronic_absenteeism_risk")
    finally:
        latency = int((time.time() - start) * 1000)
        log_tool_call(
            client=client,
            user_id=user_id,
            district_id=district_id,
            tool_name="predict_chronic_absenteeism_risk",
            inputs_summary={"student_id": student_id},
            output_summary=str(result)[:200] if result else "null",
            latency_ms=latency,
            error=error_msg,
        )
