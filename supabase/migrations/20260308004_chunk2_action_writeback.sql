-- ================================================================
-- Migration: 20260308004_chunk2_action_writeback.sql
-- Purpose: Data cleanup for Chunk 2 — action writeback & documents
-- ================================================================

-- 1. Ensure tier_requirements JSONB exists on all compliance cases
-- with the correct nested structure if currently null or empty
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
WHERE tier_requirements IS NULL
  OR tier_requirements = '{}'::jsonb;

-- 2. Backfill completion_data on actions that are completed but have
-- no completion_data recorded
UPDATE actions
SET completion_data = jsonb_build_object(
  'date_completed', COALESCE(completed_at::text, now()::text),
  'backfilled', true
)
WHERE status = 'completed'
  AND (completion_data IS NULL OR completion_data = '{}'::jsonb);

-- 3. Add doc_type values we need for Chunk 2 documents
-- (interventions_log and attendance_record were not in the original CHECK)
DO $$
BEGIN
  -- Drop and recreate the check constraint to include new doc types
  ALTER TABLE compliance_documents
    DROP CONSTRAINT IF EXISTS compliance_documents_doc_type_check;
  ALTER TABLE compliance_documents
    ADD CONSTRAINT compliance_documents_doc_type_check
    CHECK (doc_type IN (
      'tier1_notification',
      'tier2_conference_notice',
      'tier2_conference_summary',
      'tier3_sarb_cover_letter',
      'tier3_sarb_packet',
      'general_letter',
      'interventions_log',
      'attendance_record'
    ));
END $$;
