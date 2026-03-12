-- ============================================================================
-- Migration: Structured Compliance Workflow
-- Date: 2026-03-06
-- Description: Upgrades the compliance system from free-text to structured,
--   legally-sequenced documentation. Every action completion captures specific
--   fields a SARB panel, judge, or auditor would require.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Actions table: structured completion data
-- ----------------------------------------------------------------------------

-- Structured JSONB captured from type-specific completion forms
ALTER TABLE actions ADD COLUMN IF NOT EXISTS completion_data JSONB DEFAULT '{}';

-- NOTE: completed_by UUID and completed_at TIMESTAMPTZ already exist on actions table

-- ----------------------------------------------------------------------------
-- 2. Compliance cases: tier requirements, escalation gating, resolution
-- ----------------------------------------------------------------------------

-- Tracks which legal requirements have been fulfilled at each tier
-- Example structure:
-- {
--   "tier_1": {
--     "notification_sent": { "completed": true, "date": "2026-01-15", "method": "certified_mail", "tracking": "9405..." },
--     "notification_language_compliant": true
--   },
--   "tier_2": {
--     "conference_attempted": { "completed": true, "date": "2026-02-01" },
--     "conference_held": { "completed": true, "date": "2026-02-05", "attendees": ["parent", "counselor", "principal"] },
--     "resources_offered": true,
--     "consequences_explained": true
--   },
--   "tier_3": {
--     "sarb_packet_assembled": false,
--     "prior_tiers_documented": false,
--     "referral_submitted": false
--   }
-- }
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS tier_requirements JSONB DEFAULT '{}';

-- Reason escalation was blocked (e.g., "Tier 1 notification not yet sent")
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS escalation_blocked_reason TEXT;

-- Case resolution tracking
-- NOTE: resolved_at and resolution_notes already exist on compliance_cases
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS resolution_type TEXT
  CHECK (resolution_type IN (
    'attendance_improved', 'sarb_completed', 'transferred',
    'withdrawn', 'da_referral', 'other'
  ));

-- ----------------------------------------------------------------------------
-- 3. Compliance documents table (generated letters, packets)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES compliance_cases(id) NOT NULL,
  student_id UUID REFERENCES students(id) NOT NULL,
  school_id UUID REFERENCES schools(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'tier1_notification', 'tier2_conference_notice', 'tier2_conference_summary',
    'tier3_sarb_cover_letter', 'tier3_sarb_packet', 'general_letter'
  )),
  title TEXT NOT NULL,
  content_json JSONB NOT NULL,       -- structured content for regeneration
  pdf_url TEXT,                       -- if stored externally
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  sent_method TEXT CHECK (sent_method IN ('mail', 'hand_delivery', 'email', 'certified_mail')),
  delivery_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_sees_own_school_docs" ON compliance_documents
  FOR ALL USING (
    school_id IN (
      SELECT school_id FROM staff_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE INDEX idx_compliance_docs_case ON compliance_documents(case_id);
CREATE INDEX idx_compliance_docs_student ON compliance_documents(student_id);
