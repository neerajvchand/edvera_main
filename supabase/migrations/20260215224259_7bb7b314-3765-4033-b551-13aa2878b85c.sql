
-- Create memberships table
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'parent',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_role_check CHECK (role IN ('parent', 'student', 'staff', 'admin')),
  CONSTRAINT memberships_status_check CHECK (status IN ('active', 'invited', 'revoked')),
  UNIQUE (user_id, school_id, role)
);

-- Enable RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own memberships"
  ON public.memberships FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memberships"
  ON public.memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memberships"
  ON public.memberships FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memberships"
  ON public.memberships FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_district_id ON public.memberships(district_id);
CREATE INDEX idx_memberships_school_id ON public.memberships(school_id);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_membership_role(
  _user_id uuid,
  _role text,
  _school_id uuid DEFAULT NULL,
  _district_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id
      AND role = _role
      AND status = 'active'
      AND (_school_id IS NULL OR school_id = _school_id)
      AND (_district_id IS NULL OR district_id = _district_id)
  );
$$;

-- Trigger: auto-create default membership on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.memberships (user_id, role, status)
  VALUES (NEW.id, 'parent', 'active');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_membership
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_membership();
