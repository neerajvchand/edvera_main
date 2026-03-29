-- Migration: SARB Packet Assembly System
-- Adds SSID to students, root cause data and SARB status to compliance_cases,
-- and the sarb_packets table for tracking SARB referral packet assembly.

-- Add SSID field to students (statewide 10-digit ID, distinct from local student_id)
ALTER TABLE students ADD COLUMN IF NOT EXISTS ssid VARCHAR(10);

-- Add root_cause_data JSONB to compliance_cases
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS root_cause_data JSONB DEFAULT '{}'::jsonb;

-- Add sarb_packet_status to compliance_cases
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS sarb_packet_status TEXT
  CHECK (sarb_packet_status IN ('not_started', 'draft', 'ready', 'submitted'))
  DEFAULT 'not_started';
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS sarb_packet_assembled_at TIMESTAMPTZ;
ALTER TABLE compliance_cases ADD COLUMN IF NOT EXISTS sarb_submitted_at TIMESTAMPTZ;

-- SARB packets table
CREATE TABLE IF NOT EXISTS sarb_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_case_id UUID REFERENCES compliance_cases(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  district_id UUID REFERENCES districts(id),
  school_id UUID REFERENCES schools(id),
  referral_type TEXT CHECK (referral_type IN ('initial', 'followup')) DEFAULT 'initial',
  narrative_summary TEXT,
  narrative_last_edited_by UUID REFERENCES auth.users(id),
  attendees JSONB DEFAULT '[]'::jsonb,
  special_ed_notes TEXT,
  packet_components JSONB DEFAULT '{}'::jsonb,
  assembled_by UUID REFERENCES auth.users(id),
  assembled_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sarb_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_access_sarb_packets" ON sarb_packets
  FOR ALL USING (public.is_active_staff(auth.uid(), school_id));

-- Index for lookup by compliance case
CREATE INDEX IF NOT EXISTS idx_sarb_packets_case ON sarb_packets(compliance_case_id);
CREATE INDEX IF NOT EXISTS idx_sarb_packets_student ON sarb_packets(student_id);

-- Index for SSID lookups
CREATE INDEX IF NOT EXISTS idx_students_ssid ON students(ssid) WHERE ssid IS NOT NULL;
