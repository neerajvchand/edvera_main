-- ================================================================
-- Migration: 20260308005_chunk3_sarb_resolution_approval.sql
-- Purpose: Chunk 3 — tier consistency reset, resolution, SARB approval
--
-- CRITICAL FIX: tier_requirements JSONB is inconsistent across cases.
-- Some have Tier 3 items checked without Tier 1/2 completed. This
-- migration rebuilds tier_requirements from actual action history.
-- ================================================================

-- 1. Add missing columns to compliance_cases
ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sarb_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sarb_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sarb_approval_notes TEXT;

-- 2. Reset tier_requirements from actual action evidence
-- Walk every case, inspect completed actions, rebuild JSONB
WITH action_evidence AS (
  SELECT
    a.compliance_case_id AS case_id,
    -- Tier 1: letter sent
    bool_or(
      a.action_type IN ('send_letter','send_truancy_letter','truancy_notification','send_notification_letter')
      AND a.status = 'completed'
    ) AS has_letter,
    MAX(CASE
      WHEN a.action_type IN ('send_letter','send_truancy_letter','truancy_notification','send_notification_letter')
        AND a.status = 'completed'
      THEN a.completed_at::text
    END) AS letter_at,
    MAX(CASE
      WHEN a.action_type IN ('send_letter','send_truancy_letter','truancy_notification','send_notification_letter')
        AND a.status = 'completed'
      THEN a.completion_data->>'method'
    END) AS letter_method,
    -- Tier 2: conference
    bool_or(
      a.action_type IN ('schedule_conference','parent_guardian_conference','conference')
      AND a.status = 'completed'
    ) AS has_conference,
    MAX(CASE
      WHEN a.action_type IN ('schedule_conference','parent_guardian_conference','conference')
        AND a.status = 'completed'
      THEN a.completed_at::text
    END) AS conference_at,
    bool_or(
      a.action_type IN ('schedule_conference','parent_guardian_conference','conference')
      AND a.status = 'completed'
      AND (a.completion_data->>'resources_offered') IN ('true','t','1')
    ) AS has_resources,
    bool_or(
      a.action_type IN ('schedule_conference','parent_guardian_conference','conference')
      AND a.status = 'completed'
      AND (a.completion_data->>'consequences_explained') IN ('true','t','1')
    ) AS has_consequences,
    -- Tier 3: SARB packet
    bool_or(
      a.action_type IN ('prepare_sarb_packet','sarb_referral','sarb_packet')
      AND a.status = 'completed'
    ) AS has_sarb,
    MAX(CASE
      WHEN a.action_type IN ('prepare_sarb_packet','sarb_referral','sarb_packet')
        AND a.status = 'completed'
      THEN a.completed_at::text
    END) AS sarb_at
  FROM actions a
  WHERE a.compliance_case_id IS NOT NULL
  GROUP BY a.compliance_case_id
)
UPDATE compliance_cases cc
SET tier_requirements = jsonb_build_object(
  'tier_1', jsonb_build_object(
    'notification_sent', jsonb_build_object(
      'completed', COALESCE(ae.has_letter, false),
      'completedAt', ae.letter_at,
      'method', ae.letter_method
    ),
    'notification_language_compliant', jsonb_build_object(
      'completed', COALESCE(ae.has_letter, false),
      'completedAt', ae.letter_at
    )
  ),
  'tier_2', jsonb_build_object(
    'conference_held', jsonb_build_object(
      'completed', COALESCE(ae.has_conference, false),
      'completedAt', ae.conference_at
    ),
    'resources_offered', jsonb_build_object(
      'completed', COALESCE(ae.has_resources, false),
      'completedAt', CASE WHEN ae.has_resources THEN ae.conference_at END
    ),
    'consequences_explained', jsonb_build_object(
      'completed', COALESCE(ae.has_consequences, false),
      'completedAt', CASE WHEN ae.has_consequences THEN ae.conference_at END
    )
  ),
  'tier_3', jsonb_build_object(
    'packet_assembled', jsonb_build_object(
      'completed', COALESCE(ae.has_sarb, false),
      'completedAt', ae.sarb_at
    ),
    'prior_tiers_documented', jsonb_build_object(
      'completed', COALESCE(ae.has_letter, false) AND COALESCE(ae.has_conference, false),
      'completedAt', CASE
        WHEN ae.has_letter AND ae.has_conference
        THEN GREATEST(ae.letter_at, ae.conference_at)
      END
    ),
    'referral_submitted', jsonb_build_object(
      'completed', cc.sarb_packet_status = 'submitted',
      'completedAt', cc.sarb_submitted_at::text
    )
  )
)
FROM action_evidence ae
WHERE cc.id = ae.case_id;

-- 3. Cases with NO actions get the clean default structure
UPDATE compliance_cases
SET tier_requirements = '{
  "tier_1": {
    "notification_sent": {"completed": false, "completedAt": null},
    "notification_language_compliant": {"completed": false, "completedAt": null}
  },
  "tier_2": {
    "conference_held": {"completed": false, "completedAt": null},
    "resources_offered": {"completed": false, "completedAt": null},
    "consequences_explained": {"completed": false, "completedAt": null}
  },
  "tier_3": {
    "packet_assembled": {"completed": false, "completedAt": null},
    "prior_tiers_documented": {"completed": false, "completedAt": null},
    "referral_submitted": {"completed": false, "completedAt": null}
  }
}'::jsonb
WHERE id NOT IN (
  SELECT DISTINCT compliance_case_id
  FROM actions
  WHERE compliance_case_id IS NOT NULL
);

-- 4. Add indexes for approval lookups
CREATE INDEX IF NOT EXISTS idx_compliance_cases_sarb_approved
  ON compliance_cases(sarb_approved_by)
  WHERE sarb_approved_by IS NOT NULL;
