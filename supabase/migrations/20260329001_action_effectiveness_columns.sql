-- ================================================================
-- Migration: 20260329001_action_effectiveness_columns.sql
-- Purpose: Add effectiveness tracking columns to actions table.
--
-- When an action is completed, we snapshot the student's attendance
-- rate at that moment (attendance_rate_before). A background engine
-- phase fills in attendance_rate_after_30d once 30 days have passed.
-- This enables "did this intervention actually help?" analysis.
-- ================================================================

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS attendance_rate_before numeric(5,2),
  ADD COLUMN IF NOT EXISTS attendance_rate_after_30d numeric(5,2);

-- Index for the backfill engine: find completed actions needing 30-day measurement
CREATE INDEX IF NOT EXISTS idx_actions_effectiveness_backfill
  ON actions(completed_at)
  WHERE status = 'completed'
    AND attendance_rate_before IS NOT NULL
    AND attendance_rate_after_30d IS NULL;
