-- ================================================================
-- Migration: 20260312002_sart_workflow.sql
-- Purpose: Add SART workflow and root cause assessment support
--          to compliance cases, intervention_log, and districts.
-- ================================================================

-- 1. Root cause assessment + SART referral data on compliance cases
ALTER TABLE public.compliance_cases
  ADD COLUMN IF NOT EXISTS root_cause JSONB,
  ADD COLUMN IF NOT EXISTS sart_data JSONB;

-- 2. Structured metadata on intervention_log for SART meetings
--    and follow-ups (attendees, agenda, action item refs, etc.)
ALTER TABLE public.intervention_log
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. County SART toolkit link on districts
ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS toolkit_url TEXT,
  ADD COLUMN IF NOT EXISTS toolkit_name TEXT;
