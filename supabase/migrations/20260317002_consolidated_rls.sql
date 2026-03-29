-- =====================================================================
-- Migration: 20260317002_consolidated_rls.sql
-- Purpose:   Prompt 6 Phase B — Consolidated RLS policies.
--
-- NOTE: During testing we discovered several policies were needed.
--       After auditing the schema, most already exist:
--
--   B1: compliance_cases UPDATE — EXISTS in 20260308002_fix_rls_policies.sql
--       ("Staff can update compliance_cases" USING is_active_staff)
--
--   B2: intervention_log INSERT — EXISTS in 20260308002_fix_rls_policies.sql
--       ("Staff can insert intervention_log" WITH CHECK is_active_staff)
--
--   B3: compliance_documents INSERT — EXISTS in 20260307_compliance_enhancements.sql
--       ("staff_sees_own_school_docs" FOR ALL — covers INSERT via school_id)
--
--   B4: sarb_packets INSERT — EXISTS in 20260308001_sarb_packet_system.sql
--       ("staff_access_sarb_packets" FOR ALL — covers all operations)
--
-- The policies below are added defensively with IF NOT EXISTS guards.
-- They use case_id-based lookups as an alternative to direct school_id
-- checks, providing coverage when school_id is NULL on documents.
-- =====================================================================

-- -----------------------------------------------------------------
-- B1: compliance_cases UPDATE (already exists — guard only)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'compliance_cases'
      AND policyname = 'Staff can update compliance_cases'
  ) THEN
    CREATE POLICY "Staff can update compliance_cases"
      ON public.compliance_cases FOR UPDATE TO authenticated
      USING (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;

-- -----------------------------------------------------------------
-- B2: intervention_log INSERT (already exists — guard only)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'intervention_log'
      AND policyname = 'Staff can insert intervention_log'
  ) THEN
    CREATE POLICY "Staff can insert intervention_log"
      ON public.intervention_log FOR INSERT TO authenticated
      WITH CHECK (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;

-- -----------------------------------------------------------------
-- B3: compliance_documents INSERT via case_id
--     (The existing FOR ALL policy uses school_id directly, which
--      fails if school_id is NULL. This adds a case_id-based path.)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'compliance_documents'
      AND policyname = 'staff_can_insert_compliance_documents_via_case'
  ) THEN
    CREATE POLICY "staff_can_insert_compliance_documents_via_case"
      ON public.compliance_documents FOR INSERT TO authenticated
      WITH CHECK (
        case_id IN (
          SELECT id FROM compliance_cases cc
          WHERE cc.school_id IN (
            SELECT school_id FROM staff_memberships
            WHERE user_id = auth.uid() AND is_active = true
          )
        )
      );
  END IF;
END $$;

-- -----------------------------------------------------------------
-- B4: sarb_packets INSERT (already covered by FOR ALL — guard only)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sarb_packets'
      AND policyname = 'staff_access_sarb_packets'
  ) THEN
    CREATE POLICY "staff_access_sarb_packets"
      ON public.sarb_packets FOR ALL TO authenticated
      USING (public.is_active_staff(auth.uid(), school_id));
  END IF;
END $$;
