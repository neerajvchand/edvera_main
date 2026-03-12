-- ================================================================
-- Migration: 20260312001_action_attribution_columns.sql
-- Purpose: Add denormalized attribution columns to actions table
--          for completed_by_name and completed_by_role so that
--          dashboards and activity feeds can display who completed
--          an action without joining to profiles.
-- ================================================================

-- Add denormalized attribution columns
ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS completed_by_name text,
  ADD COLUMN IF NOT EXISTS completed_by_role text;

-- Index for recent-activity queries (completed actions by timestamp)
CREATE INDEX IF NOT EXISTS idx_actions_completed_at
  ON public.actions (completed_at DESC)
  WHERE status = 'completed';
