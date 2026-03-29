-- ================================================================
-- Migration: 20260329002_monitoring_period_stage.sql
-- Purpose: Add 'monitoring_period' to case_workflow_stage constraint.
--
-- When a student's attendance improves during an active case, staff
-- can place the case into a monitoring period (30-60 days) before
-- resolving. The system tracks the monitoring start date and can
-- auto-generate a resolution recommendation if improvement holds.
-- ================================================================

-- Drop and recreate the constraint to add the new stage
ALTER TABLE compliance_cases
  DROP CONSTRAINT IF EXISTS compliance_cases_case_workflow_stage_check;

ALTER TABLE compliance_cases
  ADD CONSTRAINT compliance_cases_case_workflow_stage_check
  CHECK (case_workflow_stage IN (
    'new','needs_review','outreach_in_progress','barrier_assessment',
    'intervention_active','compliance_prep','ready_for_board',
    'monitoring_period','closed'
  ));

-- Track when monitoring started (for auto-resolution advisory timing)
ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS monitoring_started_at timestamptz;
