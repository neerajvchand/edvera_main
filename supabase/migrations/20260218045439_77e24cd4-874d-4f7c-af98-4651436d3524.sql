
-- 1. Create a secure RPC for onboarding: create district + link to school
-- This replaces the direct INSERT into districts and UPDATE on schools
CREATE OR REPLACE FUNCTION public.link_school_district(
  p_school_id uuid,
  p_district_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_district_id uuid;
  v_existing_district_id uuid;
BEGIN
  -- Only authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user has access to this school
  IF NOT public.user_has_school_access(auth.uid(), p_school_id) THEN
    -- Allow if user is about to add their first child (no children yet)
    -- This is needed for onboarding flow
    IF EXISTS (SELECT 1 FROM children WHERE parent_id = auth.uid() AND is_active = true) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  -- Check if school already has a district
  SELECT district_id INTO v_existing_district_id
  FROM schools WHERE id = p_school_id;

  IF v_existing_district_id IS NOT NULL THEN
    RETURN v_existing_district_id;
  END IF;

  -- Create district
  INSERT INTO districts (name)
  VALUES (p_district_name)
  RETURNING id INTO v_district_id;

  -- Link school to district
  UPDATE schools SET district_id = v_district_id WHERE id = p_school_id;

  RETURN v_district_id;
END;
$$;

-- 2. Restrict districts INSERT: only admins can insert directly
DROP POLICY IF EXISTS "Authenticated users can insert districts" ON public.districts;
CREATE POLICY "Admins can insert districts"
  ON public.districts FOR INSERT
  WITH CHECK (
    has_membership_role(auth.uid(), 'admin'::text)
  );

-- 3. Restrict schools UPDATE: only admins can update directly
DROP POLICY IF EXISTS "Authenticated users can update school district_id" ON public.schools;
CREATE POLICY "Admins can update schools"
  ON public.schools FOR UPDATE
  USING (has_membership_role(auth.uid(), 'admin'::text))
  WITH CHECK (has_membership_role(auth.uid(), 'admin'::text));

-- 4. Lock down ingestion_runs: only admins can read
DROP POLICY IF EXISTS "Authenticated users can read ingestion_runs" ON public.ingestion_runs;
CREATE POLICY "Admins can read ingestion_runs"
  ON public.ingestion_runs FOR SELECT
  USING (has_membership_role(auth.uid(), 'admin'::text));
