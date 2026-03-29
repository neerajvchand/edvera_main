-- ============================================================================
-- Migration: Case Workspace Foundations
-- Date: 2026-03-08
-- Description: Adds county_offices reference table, enriches districts/schools/
--   profiles with fields needed for the unified Case Workspace page.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. County offices table (reference data, not tenant data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS county_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  state TEXT NOT NULL DEFAULT 'CA',
  county TEXT NOT NULL,
  sarb_coordinator_name TEXT,
  sarb_coordinator_email TEXT,
  sarb_coordinator_phone TEXT,
  sarb_meeting_location TEXT,
  sarb_meeting_schedule TEXT,
  sarb_referral_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: county_offices is reference data, readable by all authenticated users
ALTER TABLE county_offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_county_offices" ON county_offices
  FOR SELECT USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 2. Seed SMCOE
-- ----------------------------------------------------------------------------
INSERT INTO county_offices (
  name, short_name, state, county,
  sarb_coordinator_name,
  sarb_coordinator_email,
  sarb_coordinator_phone,
  sarb_meeting_location,
  sarb_meeting_schedule,
  sarb_referral_instructions
) VALUES (
  'San Mateo County Office of Education',
  'SMCOE',
  'CA',
  'San Mateo',
  'Christina Sellers',
  'csellers@smcoe.org',
  NULL,
  '455 County Center, Room 101, Redwood City, CA 94065',
  'Fourth Friday of the month, 9:00am–1:00pm',
  'Email completed referral packets to the SARB coordinator to initiate the County SARB process.'
);

-- ----------------------------------------------------------------------------
-- 3. Add missing columns to districts
-- ----------------------------------------------------------------------------
ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS superintendent_name TEXT,
  ADD COLUMN IF NOT EXISTS county_office_id UUID REFERENCES county_offices(id);

-- ----------------------------------------------------------------------------
-- 4. Add missing columns to schools (some already exist, IF NOT EXISTS is safe)
-- ----------------------------------------------------------------------------
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS principal_name TEXT,
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id);

-- ----------------------------------------------------------------------------
-- 5. Add role to profiles
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT
    CHECK (role IN ('district_admin', 'principal', 'attendance_clerk', 'counselor', 'read_only'))
    DEFAULT 'attendance_clerk';

-- ----------------------------------------------------------------------------
-- 6. Seed district data
-- ----------------------------------------------------------------------------
UPDATE districts SET
  address = '1 Hiller Drive, Oakland, CA 94621',
  phone = '(510) 555-0100',
  superintendent_name = 'Dr. Jane Smith',
  county_office_id = (SELECT id FROM county_offices WHERE short_name = 'SMCOE')
WHERE name = 'Pacific Unified School District';

-- ----------------------------------------------------------------------------
-- 7. Seed school data
-- ----------------------------------------------------------------------------
UPDATE schools SET
  address = '100 Bayshore Blvd, San Bruno, CA 94066',
  phone = '(650) 555-0101',
  principal_name = 'Dr. Maria Gonzalez',
  district_id = (SELECT id FROM districts WHERE name = 'Pacific Unified School District')
WHERE name = 'Bayshore Elementary';

UPDATE schools SET
  address = '200 Hillcrest Ave, San Bruno, CA 94066',
  phone = '(650) 555-0102',
  principal_name = 'Mr. David Chen',
  district_id = (SELECT id FROM districts WHERE name = 'Pacific Unified School District')
WHERE name = 'Hillcrest Middle';

UPDATE schools SET
  address = '300 Pacific Drive, San Bruno, CA 94066',
  phone = '(650) 555-0103',
  principal_name = 'Ms. Sarah Johnson',
  district_id = (SELECT id FROM districts WHERE name = 'Pacific Unified School District')
WHERE name = 'Pacific High';

-- ----------------------------------------------------------------------------
-- 8. Set test account to district_admin
-- ----------------------------------------------------------------------------
UPDATE profiles
SET role = 'district_admin'
WHERE user_id = (
  SELECT id FROM auth.users
  WHERE email = 'pikachu@pikachu.com'
);
