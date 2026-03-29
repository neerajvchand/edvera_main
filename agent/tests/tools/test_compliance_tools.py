from __future__ import annotations

import pytest

from agent.tools.compliance_tools import (
    _parse_tier_requirements,
    _extract_item,
    lookup_education_code,
)
from agent.tools.intervention_tools import _apply_compliance_ladder


# ---------------------------------------------------------------------------
# _parse_tier_requirements — must match TypeScript buildTierChecklist()
# ---------------------------------------------------------------------------

class TestParseTierRequirements:
    def test_tier1_complete_detection(self):
        raw = {
            "tier_1": {
                "notification_sent": {"completed": True},
                "notification_language_compliant": {"completed": True},
            },
            "tier_2": {
                "conference_held": {"completed": False},
            },
        }
        result = _parse_tier_requirements(raw)
        assert result["tier1_complete"] is True
        assert result["tier2_complete"] is False
        assert result["notification_sent"] is True
        assert result["legal_language"] is True

    def test_tier2_complete_detection(self):
        raw = {
            "tier_1": {
                "notification_sent": {"completed": True},
                "notification_language_compliant": {"completed": True},
            },
            "tier_2": {
                "conference_held": {"completed": True},
                "resources_offered": {"completed": True},
                "consequences_explained": {"completed": True},
            },
        }
        result = _parse_tier_requirements(raw)
        assert result["tier1_complete"] is True
        assert result["tier2_complete"] is True
        assert result["tier3_complete"] is False

    def test_tier3_complete_detection(self):
        raw = {
            "tier_1": {
                "notification_sent": {"completed": True},
                "notification_language_compliant": {"completed": True},
            },
            "tier_2": {
                "conference_held": {"completed": True},
                "resources_offered": {"completed": True},
                "consequences_explained": {"completed": True},
            },
            "tier_3": {
                "packet_assembled": {"completed": True},
                "prior_tiers_documented": {"completed": True},
                "referral_submitted": {"completed": True},
            },
        }
        result = _parse_tier_requirements(raw)
        assert result["tier1_complete"] is True
        assert result["tier2_complete"] is True
        assert result["tier3_complete"] is True

    def test_empty_requirements(self):
        result = _parse_tier_requirements({})
        assert result["tier1_complete"] is False
        assert result["tier2_complete"] is False
        assert result["tier3_complete"] is False
        assert result["notification_sent"] is False

    def test_none_requirements(self):
        result = _parse_tier_requirements(None)
        assert result["tier1_complete"] is False

    def test_boolean_shorthand(self):
        """TypeScript extractItem supports val being a plain boolean."""
        raw = {
            "tier_1": {
                "notification_sent": True,
                "notification_language_compliant": True,
            },
        }
        result = _parse_tier_requirements(raw)
        assert result["tier1_complete"] is True
        assert result["notification_sent"] is True

    def test_partial_tier1(self):
        raw = {
            "tier_1": {
                "notification_sent": {"completed": True},
                # notification_language_compliant missing
            },
        }
        result = _parse_tier_requirements(raw)
        assert result["tier1_complete"] is False
        assert result["notification_sent"] is True
        assert result["legal_language"] is False

    def test_checklist_structure(self):
        raw = {
            "tier_1": {
                "notification_sent": {
                    "completed": True,
                    "completedAt": "2026-03-01T10:00:00Z",
                },
            },
        }
        result = _parse_tier_requirements(raw)
        tier1_items = result["tier_requirements"]["tier1"]
        assert len(tier1_items) == 2
        notif = tier1_items[0]
        assert notif["key"] == "notification_sent"
        assert notif["completed"] is True
        assert notif["completed_at"] == "2026-03-01T10:00:00Z"
        assert notif["source"] == "action"


# ---------------------------------------------------------------------------
# _extract_item — mirrors TypeScript extractItem()
# ---------------------------------------------------------------------------

class TestExtractItem:
    def test_dict_with_completed(self):
        item = _extract_item(
            {"foo": {"completed": True, "completedAt": "2026-01-01"}},
            "foo", "Foo label", "action",
        )
        assert item["completed"] is True
        assert item["completed_at"] == "2026-01-01"

    def test_dict_with_date_fallback(self):
        """If no completedAt, fall back to date field."""
        item = _extract_item(
            {"foo": {"completed": True, "date": "2026-02-15"}},
            "foo", "Foo label", "action",
        )
        assert item["completed_at"] == "2026-02-15"

    def test_boolean_value(self):
        item = _extract_item({"foo": True}, "foo", "Foo label", "action")
        assert item["completed"] is True
        assert item["completed_at"] is None

    def test_missing_key(self):
        item = _extract_item({}, "foo", "Foo label", "action")
        assert item["completed"] is False

    def test_none_value(self):
        item = _extract_item({"foo": None}, "foo", "Foo label", "action")
        assert item["completed"] is False


# ---------------------------------------------------------------------------
# _apply_compliance_ladder — deterministic decision tree
# ---------------------------------------------------------------------------

class TestComplianceLadder:
    def test_sarb_blocked_tier1_incomplete(self):
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=10,
            truancy_count=5,
            attendance_rate=0.92,
            tier1_complete=False,
            tier2_complete=False,
            sarb_eligible=False,
            active_case=True,
        )
        assert action != "sarb_referral"

    def test_truancy_letter_at_threshold(self):
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=3,
            truancy_count=3,
            attendance_rate=0.97,
            tier1_complete=False,
            tier2_complete=False,
            sarb_eligible=False,
            active_case=False,
        )
        assert action == "truancy_letter"
        assert ec == "EC §48260"
        assert urgency == "urgent"

    def test_counselor_referral_severe_absenteeism(self):
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=30,
            truancy_count=10,
            attendance_rate=0.78,
            tier1_complete=True,
            tier2_complete=True,
            sarb_eligible=True,
            active_case=True,
        )
        assert action == "counselor_referral"
        assert urgency == "urgent"

    def test_sarb_eligible_full_tiers(self):
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=18,
            truancy_count=8,
            attendance_rate=0.89,
            tier1_complete=True,
            tier2_complete=True,
            sarb_eligible=True,
            active_case=True,
        )
        assert action == "sarb_referral"
        assert ec == "EC §48263"

    def test_monitor_tiers_complete_not_sarb_eligible(self):
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=5,
            truancy_count=2,
            attendance_rate=0.96,
            tier1_complete=True,
            tier2_complete=True,
            sarb_eligible=False,
            active_case=True,
        )
        assert action in ["follow_up_call", "monitor"]

    def test_conference_after_tier1(self):
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=6,
            truancy_count=3,
            attendance_rate=0.93,
            tier1_complete=True,
            tier2_complete=False,
            sarb_eligible=False,
            active_case=True,
        )
        assert action == "conference"
        assert urgency == "elevated"
        assert ec == "EC §48262"

    def test_monitor_no_case_below_threshold(self):
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=1,
            truancy_count=0,
            attendance_rate=0.98,
            tier1_complete=False,
            tier2_complete=False,
            sarb_eligible=False,
            active_case=False,
        )
        assert action == "monitor"
        assert urgency == "routine"
        assert ec is None

    def test_counselor_overrides_sarb(self):
        """<80% rate takes priority over SARB eligibility."""
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=20,
            truancy_count=8,
            attendance_rate=0.75,
            tier1_complete=True,
            tier2_complete=True,
            sarb_eligible=True,
            active_case=True,
        )
        assert action == "counselor_referral"

    def test_sarb_eligible_but_tier2_incomplete_guard(self):
        """Edge case: sarb_eligible=True but tier2 not complete."""
        action, urgency, ec = _apply_compliance_ladder(
            unexcused_absences=12,
            truancy_count=5,
            attendance_rate=0.85,
            tier1_complete=True,
            tier2_complete=False,
            sarb_eligible=True,
            active_case=True,
        )
        # Should hit tier1_complete and not tier2_complete branch first
        assert action == "conference"
        assert urgency in ["elevated", "urgent"]


# ---------------------------------------------------------------------------
# lookup_education_code
# ---------------------------------------------------------------------------

class TestLookupEducationCode:
    def test_valid_section(self):
        result = lookup_education_code("48260")
        assert result is not None
        assert result["section"] == "48260"
        assert "citation" in result
        assert "title" in result
        assert "tags" in result
        assert isinstance(result["tags"], list)

    def test_valid_section_with_prefix(self):
        result = lookup_education_code("EC §48263")
        assert result is not None
        assert result["section"] == "48263"

    def test_invalid_section(self):
        result = lookup_education_code("99999")
        assert result is None

    def test_all_compliance_sections(self):
        for section in ["48260", "48262", "48263", "48263.6"]:
            result = lookup_education_code(section)
            assert result is not None, "Section {} should exist".format(section)
