from __future__ import annotations

import datetime
import pytest

from agent.tools.risk_tools import (
    _detect_patterns,
    _project_chronic_risk,
    compute_chronic_band,
    compute_trend,
    _parse_tier,
    _rate_to_decimal,
)


# ---------------------------------------------------------------------------
# compute helpers
# ---------------------------------------------------------------------------

class TestComputeChronicBand:
    def test_satisfactory(self):
        assert compute_chronic_band(0.97) == "satisfactory"
        assert compute_chronic_band(0.95) == "satisfactory"

    def test_at_risk(self):
        assert compute_chronic_band(0.94) == "at-risk"
        assert compute_chronic_band(0.90) == "at-risk"

    def test_moderate(self):
        assert compute_chronic_band(0.89) == "moderate"
        assert compute_chronic_band(0.80) == "moderate"

    def test_severe(self):
        assert compute_chronic_band(0.79) == "severe"
        assert compute_chronic_band(0.50) == "severe"

    def test_none(self):
        assert compute_chronic_band(None) == "satisfactory"


class TestComputeTrend:
    def test_improving(self):
        assert compute_trend(0.95, 0.88) == "improving"

    def test_declining(self):
        assert compute_trend(0.85, 0.92) == "declining"

    def test_stable(self):
        assert compute_trend(0.90, 0.91) == "stable"

    def test_none_values(self):
        assert compute_trend(None, 0.90) == "stable"
        assert compute_trend(0.90, None) == "stable"


class TestParseTier:
    def test_tiers(self):
        assert _parse_tier("tier_1_letter") == 1
        assert _parse_tier("tier_2_conference") == 2
        assert _parse_tier("tier_3_sarb_referral") == 3
        assert _parse_tier("none") is None
        assert _parse_tier(None) is None


class TestRateToDecimal:
    def test_conversion(self):
        assert _rate_to_decimal(95.0) == 0.95
        assert _rate_to_decimal(100.0) == 1.0
        assert _rate_to_decimal(None) is None


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------

class TestAbsenceStreak:
    def test_streak_detected(self):
        absences = [
            {"date": "2026-03-02", "absence_type": "unexcused"},
            {"date": "2026-03-03", "absence_type": "unexcused"},
            {"date": "2026-03-04", "absence_type": "unexcused"},
        ]
        result = _detect_patterns(absences, tardies=[])
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "absence_streak" in names

    def test_streak_across_weekend(self):
        """Fri-Mon-Tue should count as a 3-day streak."""
        absences = [
            {"date": "2026-02-27", "absence_type": "unexcused"},  # Friday
            {"date": "2026-03-02", "absence_type": "unexcused"},  # Monday
            {"date": "2026-03-03", "absence_type": "unexcused"},  # Tuesday
        ]
        result = _detect_patterns(absences, tardies=[])
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "absence_streak" in names

    def test_no_streak_if_too_short(self):
        absences = [
            {"date": "2026-03-02", "absence_type": "unexcused"},
            {"date": "2026-03-03", "absence_type": "unexcused"},
        ]
        result = _detect_patterns(absences, tardies=[])
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "absence_streak" not in names


class TestExtendedWeekend:
    def test_friday_monday(self):
        absences = [
            {"date": "2026-02-27", "absence_type": "unexcused"},  # Friday
            {"date": "2026-03-02", "absence_type": "unexcused"},  # Monday
        ]
        result = _detect_patterns(absences, tardies=[])
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "extended_weekend" in names

    def test_thursday_friday(self):
        absences = [
            {"date": "2026-02-26", "absence_type": "unexcused"},  # Thursday
            {"date": "2026-02-27", "absence_type": "unexcused"},  # Friday
        ]
        result = _detect_patterns(absences, tardies=[])
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "extended_weekend" in names


class TestTardyCluster:
    def test_cluster_detected(self):
        # 7 tardies in a 14-day window
        tardies = [
            "2026-03-01",
            "2026-03-02",
            "2026-03-03",
            "2026-03-04",
            "2026-03-05",
            "2026-03-06",
            "2026-03-09",
        ]
        result = _detect_patterns(absences=[], tardies=tardies)
        assert result["tardy_escalation_detected"] is True
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "tardy_cluster" in names

    def test_no_cluster_below_threshold(self):
        tardies = ["2026-03-01", "2026-03-05"]
        result = _detect_patterns(absences=[], tardies=tardies)
        assert result["tardy_escalation_detected"] is False


class TestPostHolidayCluster:
    def test_post_thanksgiving(self):
        # Dec 1 is within 5 calendar days of Thanksgiving end (Nov 28)
        absences = [
            {"date": "2025-12-01", "absence_type": "unexcused"},
        ]
        result = _detect_patterns(absences, tardies=[])
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "post_holiday_cluster" in names
        detail = next(
            p for p in result["patterns_detected"]
            if p["pattern"] == "post_holiday_cluster"
        )
        assert "Thanksgiving" in detail["detail"]["holidays"]


class TestPreVacationAbsence:
    def test_before_winter_break(self):
        # Dec 19 is the last school day before winter break
        absences = [
            {"date": "2025-12-19", "absence_type": "unexcused"},
        ]
        result = _detect_patterns(absences, tardies=[])
        names = [p["pattern"] for p in result["patterns_detected"]]
        assert "pre_vacation_absence" in names
        detail = next(
            p for p in result["patterns_detected"]
            if p["pattern"] == "pre_vacation_absence"
        )
        assert "Winter" in detail["detail"]["breaks"]


class TestNoPatterns:
    def test_single_absence(self):
        absences = [
            {"date": "2026-03-01", "absence_type": "unexcused"},
        ]
        result = _detect_patterns(absences, tardies=[])
        assert len(result["patterns_detected"]) == 0

    def test_empty(self):
        result = _detect_patterns(absences=[], tardies=[])
        assert len(result["patterns_detected"]) == 0
        assert result["dominant_pattern"] is None
        assert result["tardy_escalation_detected"] is False


# ---------------------------------------------------------------------------
# Chronic risk projection
# ---------------------------------------------------------------------------

class TestChronicRiskProjection:
    def test_will_exceed(self):
        result = _project_chronic_risk(
            unexcused_absences=8,
            days_enrolled=80,
            school_year_total_days=180,
        )
        assert result["will_exceed_10_percent"] is True
        assert result["confidence"] == "high"
        assert result["days_remaining_estimate"] == 100

    def test_will_not_exceed(self):
        result = _project_chronic_risk(
            unexcused_absences=2,
            days_enrolled=100,
            school_year_total_days=180,
        )
        assert result["will_exceed_10_percent"] is False

    def test_already_exceeded(self):
        result = _project_chronic_risk(
            unexcused_absences=15,
            days_enrolled=100,
            school_year_total_days=180,
        )
        assert result["will_exceed_10_percent"] is True
        assert result["days_until_threshold"] == 0

    def test_low_confidence(self):
        result = _project_chronic_risk(
            unexcused_absences=2,
            days_enrolled=15,
            school_year_total_days=180,
        )
        assert result["confidence"] == "low"

    def test_medium_confidence(self):
        result = _project_chronic_risk(
            unexcused_absences=3,
            days_enrolled=45,
            school_year_total_days=180,
        )
        assert result["confidence"] == "medium"

    def test_zero_enrolled(self):
        result = _project_chronic_risk(
            unexcused_absences=0,
            days_enrolled=0,
            school_year_total_days=180,
        )
        assert result["will_exceed_10_percent"] is False
        assert result["confidence"] == "low"
