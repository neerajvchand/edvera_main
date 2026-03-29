-- ================================================================
-- Migration: 20260316002_four_layer_state_model.sql
-- Purpose: Add four-layer state model to compliance_cases.
--
-- Replaces the single sarb_packet_status field with four explicit
-- stage columns, each tracking a separate concern:
--   risk_stage          — attendance reality, system-driven
--   case_workflow_stage — staff operations, human-driven
--   packet_stage        — document/artifact lifecycle
--   outcome_stage       — result after SARB hearing
--
-- Old columns (current_tier, sarb_packet_status) are retained
-- for backward compatibility and will be dropped in a later migration.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Add four new stage columns
-- ----------------------------------------------------------------

ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS risk_stage TEXT NOT NULL DEFAULT 'monitoring'
    CHECK (risk_stage IN (
      'monitoring','early_concern','tier_2_support',
      'tier_3_intensive','sarb_candidate','post_sarb_followup'
    ));

ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS case_workflow_stage TEXT NOT NULL DEFAULT 'new'
    CHECK (case_workflow_stage IN (
      'new','needs_review','outreach_in_progress','barrier_assessment',
      'intervention_active','compliance_prep','ready_for_board','closed'
    ));

ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS packet_stage TEXT NOT NULL DEFAULT 'not_started'
    CHECK (packet_stage IN (
      'not_started','draft','generated',
      'under_review','approved','submitted'
    ));

ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS outcome_stage TEXT
    CHECK (outcome_stage IN (
      'pending','hearing_scheduled','agreement_reached',
      'returned_to_tier_2','resolved','referred_out'
    ));

-- ----------------------------------------------------------------
-- 2. Migrate existing data into new columns
-- ----------------------------------------------------------------

-- risk_stage: derived from current_tier
UPDATE compliance_cases SET risk_stage = CASE
  WHEN current_tier = 'tier_1_letter'         THEN 'early_concern'
  WHEN current_tier = 'tier_2_conference'     THEN 'tier_2_support'
  WHEN current_tier = 'tier_3_sarb_referral'  THEN 'tier_3_intensive'
  ELSE 'monitoring'
END;

-- case_workflow_stage: derived from is_resolved, sarb_packet_status, current_tier
UPDATE compliance_cases SET case_workflow_stage = CASE
  WHEN is_resolved = true
    THEN 'closed'
  WHEN sarb_packet_status IN ('ready_for_approval','approved','submitted')
    AND is_resolved = false
    THEN 'compliance_prep'
  WHEN current_tier = 'tier_3_sarb_referral'
    AND sarb_packet_status = 'not_started'
    THEN 'intervention_active'
  WHEN current_tier = 'tier_2_conference'
    THEN 'outreach_in_progress'
  WHEN current_tier = 'tier_1_letter'
    THEN 'needs_review'
  ELSE 'new'
END;

-- packet_stage: derived from sarb_packet_status
UPDATE compliance_cases SET packet_stage = CASE
  WHEN sarb_packet_status = 'not_started'       THEN 'not_started'
  WHEN sarb_packet_status = 'draft'             THEN 'draft'
  WHEN sarb_packet_status = 'ready_for_approval' THEN 'under_review'
  WHEN sarb_packet_status = 'approved'          THEN 'approved'
  WHEN sarb_packet_status = 'submitted'         THEN 'submitted'
  ELSE 'not_started'
END;

-- outcome_stage: derived from is_resolved and sarb_packet_status
UPDATE compliance_cases SET outcome_stage = CASE
  WHEN is_resolved = true AND resolution_type IS NOT NULL
    THEN 'resolved'
  WHEN sarb_packet_status = 'submitted' AND is_resolved = false
    THEN 'hearing_scheduled'
  ELSE NULL
END;

-- ----------------------------------------------------------------
-- 3. Mark deprecated columns
-- DEPRECATED: current_tier — use risk_stage instead.
-- DEPRECATED: sarb_packet_status — use packet_stage instead.
-- Retained for backward compatibility. Drop in migration 20260401+.
-- ----------------------------------------------------------------

COMMENT ON COLUMN compliance_cases.current_tier IS
  'DEPRECATED: use risk_stage instead. Retained for backward compatibility. Drop in migration 20260401+.';

COMMENT ON COLUMN compliance_cases.sarb_packet_status IS
  'DEPRECATED: use packet_stage instead. Retained for backward compatibility. Drop in migration 20260401+.';

-- ----------------------------------------------------------------
-- 4. Indexes for common queries on new columns
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_compliance_cases_workflow_stage
  ON compliance_cases(case_workflow_stage)
  WHERE case_workflow_stage != 'closed';

CREATE INDEX IF NOT EXISTS idx_compliance_cases_risk_stage
  ON compliance_cases(risk_stage);
