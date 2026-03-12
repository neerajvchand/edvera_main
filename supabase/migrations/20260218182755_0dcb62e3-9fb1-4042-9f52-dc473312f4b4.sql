
-- =============================================
-- ADMIN PORTAL MVP — Database Migration
-- =============================================

-- 1) staff_memberships table
CREATE TABLE public.staff_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'office_staff',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id)
);

ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;

-- Security definer to check staff membership
CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships
    WHERE user_id = _user_id
      AND school_id = _school_id
      AND is_active = true
  );
$$;

-- Staff can read their own memberships
CREATE POLICY "Staff can read own memberships"
  ON public.staff_memberships FOR SELECT
  USING (auth.uid() = user_id);

-- 2) school_profiles table
CREATE TABLE public.school_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  bell_schedule_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  quick_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.school_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read school profile"
  ON public.school_profiles FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can update school profile"
  ON public.school_profiles FOR UPDATE
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can insert school profile"
  ON public.school_profiles FOR INSERT
  WITH CHECK (public.is_active_staff(auth.uid(), school_id));

-- 3) announcements table
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read announcements"
  ON public.announcements FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can insert announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can update announcements"
  ON public.announcements FOR UPDATE
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can delete announcements"
  ON public.announcements FOR DELETE
  USING (public.is_active_staff(auth.uid(), school_id));

-- 4) attendance_triage table
CREATE TABLE public.attendance_triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  attendance_date date NOT NULL,
  submitted_status text NOT NULL,
  submitted_reason text,
  submitted_by_user_id uuid REFERENCES auth.users(id),
  source_attendance_entry_id uuid,
  triage_status text NOT NULL DEFAULT 'new',
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_id, attendance_date)
);

ALTER TABLE public.attendance_triage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read triage for their school"
  ON public.attendance_triage FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can update triage for their school"
  ON public.attendance_triage FOR UPDATE
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can insert triage"
  ON public.attendance_triage FOR INSERT
  WITH CHECK (public.is_active_staff(auth.uid(), school_id));

-- Parents can also insert triage rows (when submitting attendance)
CREATE POLICY "Parents can insert own triage"
  ON public.attendance_triage FOR INSERT
  WITH CHECK (auth.uid() = submitted_by_user_id);

-- 5) audit_log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id),
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read audit log"
  ON public.audit_log FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can insert audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (public.is_active_staff(auth.uid(), school_id));

-- Allow authenticated users to insert audit log for triage submissions
CREATE POLICY "Authenticated users can insert own audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() = actor_user_id);

-- Add created_by/updated_by to existing school_events if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_events' AND column_name = 'created_by') THEN
    ALTER TABLE public.school_events ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_events' AND column_name = 'updated_by') THEN
    ALTER TABLE public.school_events ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_events' AND column_name = 'updated_at') THEN
    ALTER TABLE public.school_events ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Allow staff to insert/update/delete school_events
CREATE POLICY "Staff can insert school events"
  ON public.school_events FOR INSERT
  WITH CHECK (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can update school events"
  ON public.school_events FOR UPDATE
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can delete school events"
  ON public.school_events FOR DELETE
  USING (public.is_active_staff(auth.uid(), school_id));

-- Triggers for updated_at
CREATE TRIGGER update_school_profiles_updated_at
  BEFORE UPDATE ON public.school_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_triage_updated_at
  BEFORE UPDATE ON public.attendance_triage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
