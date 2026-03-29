-- =====================================================================
-- Add missing INSERT / UPDATE RLS policies for the CSV-import flow.
--
-- Problem:  staff_memberships, students, enrollments, attendance_daily,
--           and school_calendars all had RLS enabled with only SELECT
--           policies.  The browser import (anon key) could never INSERT
--           into these tables — the writes were silently denied by RLS,
--           leaving the user with no staff_memberships and therefore
--           unable to read compliance_cases.
--
-- Fix:     Add write policies so the authenticated import user can:
--          (a) bootstrap their own staff_membership rows
--          (b) insert/update students, attendance, enrollments, and
--              school_calendars for schools where they are active staff
-- =====================================================================

-- -----------------------------------------------------------------
-- 1) staff_memberships — bootstrap: users can add themselves
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_memberships'
      AND policyname = 'Users can insert own memberships'
  ) THEN
    CREATE POLICY "Users can insert own memberships"
      ON public.staff_memberships FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_memberships'
      AND policyname = 'Users can update own memberships'
  ) THEN
    CREATE POLICY "Users can update own memberships"
      ON public.staff_memberships FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- -----------------------------------------------------------------
-- 2) students — staff can write for their schools
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'students'
      AND policyname = 'Staff can insert students'
  ) THEN
    CREATE POLICY "Staff can insert students"
      ON public.students FOR INSERT
      WITH CHECK (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'students'
      AND policyname = 'Staff can update students'
  ) THEN
    CREATE POLICY "Staff can update students"
      ON public.students FOR UPDATE
      USING (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;


-- -----------------------------------------------------------------
-- 3) enrollments — staff can write for their schools
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'enrollments'
      AND policyname = 'Staff can insert enrollments'
  ) THEN
    CREATE POLICY "Staff can insert enrollments"
      ON public.enrollments FOR INSERT
      WITH CHECK (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'enrollments'
      AND policyname = 'Staff can update enrollments'
  ) THEN
    CREATE POLICY "Staff can update enrollments"
      ON public.enrollments FOR UPDATE
      USING (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;


-- -----------------------------------------------------------------
-- 4) attendance_daily — staff can write for their schools
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance_daily'
      AND policyname = 'Staff can insert attendance_daily'
  ) THEN
    CREATE POLICY "Staff can insert attendance_daily"
      ON public.attendance_daily FOR INSERT
      WITH CHECK (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance_daily'
      AND policyname = 'Staff can update attendance_daily'
  ) THEN
    CREATE POLICY "Staff can update attendance_daily"
      ON public.attendance_daily FOR UPDATE
      USING (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;


-- -----------------------------------------------------------------
-- 5) school_calendars — staff can write for their schools
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_calendars'
      AND policyname = 'Staff can insert school_calendars'
  ) THEN
    CREATE POLICY "Staff can insert school_calendars"
      ON public.school_calendars FOR INSERT
      WITH CHECK (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_calendars'
      AND policyname = 'Staff can update school_calendars'
  ) THEN
    CREATE POLICY "Staff can update school_calendars"
      ON public.school_calendars FOR UPDATE
      USING (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;
