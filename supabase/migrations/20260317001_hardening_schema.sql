-- =====================================================================
-- Migration: 20260317001_hardening_schema.sql
-- Purpose:   Prompt 6 Phase A — Schema hardening discovered during testing.
--
-- A1: Add assigned_to to compliance_cases
-- A2: Ensure cascade deletes on derived tables
-- A3: Auto-profile trigger on auth.users
-- A4: Normalize role names in staff_memberships
-- A5: Add timeline_events JSONB column for Phase F
-- =====================================================================

-- -----------------------------------------------------------------
-- A1: Add assigned_to to compliance_cases
-- -----------------------------------------------------------------
ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- -----------------------------------------------------------------
-- A2: Cascade deletes on derived tables
--     (These already have ON DELETE CASCADE in canonical_schema.sql,
--      but re-applying defensively in case they were missed.)
-- -----------------------------------------------------------------

-- funding_projections → students
ALTER TABLE funding_projections
  DROP CONSTRAINT IF EXISTS funding_projections_student_id_fkey;

ALTER TABLE funding_projections
  ADD CONSTRAINT funding_projections_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- risk_signals → students
ALTER TABLE risk_signals
  DROP CONSTRAINT IF EXISTS risk_signals_student_id_fkey;

ALTER TABLE risk_signals
  ADD CONSTRAINT risk_signals_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- attendance_snapshots → students
ALTER TABLE attendance_snapshots
  DROP CONSTRAINT IF EXISTS attendance_snapshots_student_id_fkey;

ALTER TABLE attendance_snapshots
  ADD CONSTRAINT attendance_snapshots_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------
-- A3: Auto-profile trigger on auth.users
-- -----------------------------------------------------------------

-- Ensure has_completed_onboarding column exists
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_id,
    display_name,
    email,
    has_completed_onboarding,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    false,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------
-- A4: Normalize role names
-- -----------------------------------------------------------------
UPDATE staff_memberships
SET role = 'district_admin'
WHERE role = 'admin';

ALTER TABLE staff_memberships
  DROP CONSTRAINT IF EXISTS staff_memberships_role_check;

ALTER TABLE staff_memberships
  ADD CONSTRAINT staff_memberships_role_check
  CHECK (role IN (
    'district_admin',
    'principal',
    'attendance_clerk',
    'counselor'
  ));

-- -----------------------------------------------------------------
-- A5: Timeline events JSONB column (Phase F support)
-- -----------------------------------------------------------------
ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS timeline_events JSONB NOT NULL DEFAULT '[]'::jsonb;
