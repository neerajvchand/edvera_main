import pytest
from agent.lib.tool_error import ToolError, DistrictBoundaryViolation, UserContextError
from agent.lib.ec_sections import lookup_section, get_all_sections


def test_lookup_valid_section():
    section = lookup_section("48260")
    assert section is not None
    assert section.citation == "EC §48260"
    assert "truancy" in [t.lower() for t in section.tags]


def test_lookup_invalid_section():
    section = lookup_section("99999")
    assert section is None


def test_lookup_with_symbol():
    section = lookup_section("§48260")
    assert section is not None
    assert section.section == "48260"


def test_lookup_with_prefix():
    section = lookup_section("EC §48263")
    assert section is not None
    assert section.section == "48263"


def test_all_sections_count():
    sections = get_all_sections()
    assert len(sections) == 12


def test_all_sections_have_required_fields():
    for section in get_all_sections():
        assert section.section
        assert section.citation
        assert section.title
        assert section.effective_date
        assert section.summary
        assert section.full_text
        assert len(section.tags) > 0
        assert len(section.used_in) > 0


def test_district_boundary_violation():
    error = DistrictBoundaryViolation("test_tool")
    assert error.recoverable is False
    assert error.error_type == "district_boundary_violation"
    assert error.tool_name == "test_tool"


def test_user_context_error():
    error = UserContextError("test_tool")
    assert error.recoverable is False
    assert error.error_type == "user_context_error"


def test_tool_error_recoverable_default():
    error = ToolError("test", "test_tool")
    assert error.recoverable is True
    assert error.error_type == "tool_error"
