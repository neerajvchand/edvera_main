-- ================================================================
-- Migration: 20260316001_fix_sarb_status_constraint.sql
-- Purpose: Fix the 3-way mismatch on sarb_packet_status.
--
-- The original constraint (20260308001) allows:
--   not_started, draft, ready, submitted
-- The service layer and UI use:
--   not_started, draft, ready_for_approval, approved, submitted
--
-- This migration:
--   1. Migrates 'ready' → 'ready_for_approval' (data fix)
--   2. Drops the old CHECK constraint
--   3. Adds a new CHECK constraint with all 5 valid values
-- ================================================================

-- Step 1: Data migration — convert any 'ready' rows to 'ready_for_approval'
UPDATE compliance_cases
SET sarb_packet_status = 'ready_for_approval'
WHERE sarb_packet_status = 'ready';

-- Step 2: Drop the old auto-generated CHECK constraint.
-- The inline CHECK from ADD COLUMN creates a constraint named
-- compliance_cases_sarb_packet_status_check in PostgreSQL.
ALTER TABLE compliance_cases
  DROP CONSTRAINT IF EXISTS compliance_cases_sarb_packet_status_check;

-- Step 3: Add the corrected constraint with all 5 valid states.
ALTER TABLE compliance_cases
  ADD CONSTRAINT compliance_cases_sarb_packet_status_check
  CHECK (sarb_packet_status IN (
    'not_started',
    'draft',
    'ready_for_approval',
    'approved',
    'submitted'
  ));
