-- =============================================
-- Edvera Canonical Schema v1.0
-- SIS-agnostic tables for attendance intelligence
-- Purely additive — does NOT modify or drop existing tables
-- =============================================

-- =============================================
-- 1. ENUM TYPES
-- =============================================

-- SIS platform identifiers
CREATE TYPE sis_platform AS ENUM (
  'aeries',
  'powerschool',
  'infinite_campus',
  'skyward',
  'synergy',
  'csv_upload'
);

-- Canonical absence classification
CREATE TYPE absence_type AS ENUM (
  'present',
  'absent_unverified',
  'absent_excused',
  'absent_unexcused',
  'tardy',
  'tardy_excused',
  'tardy_unexcused',
  'suspension_in_school',
  'suspension_out_of_school',
  'independent_study_complete',
  'independent_study_incomplete',
  'not_enrolled'
);

-- Sync status
CREATE TYPE sync_status AS ENUM (
  'running',
  'completed',
  'failed',
  'partial'
);

-- Risk signal levels
CREATE TYPE signal_level AS ENUM (
  'pending',
  'stable',
  'softening',
  'elevated'
);

-- SARB compliance tiers (California)
CREATE TYPE compliance_tier AS ENUM (
  'none',
  'tier_1_letter',
  'tier_2_conference',
  'tier_3_sarb_referral'
);


-- =============================================
-- 2. CANONICAL TABLES
-- =============================================

-- 2.1 sis_connections
-- One row per district. Stores which SIS platform they use and how to connect.
CREATE TABLE public.sis_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  platform sis_platform NOT NULL,
  display_name text NOT NULL,

  -- Connection config (encrypted at rest via Supabase Vault)
  base_url text,
  auth_config jsonb NOT NULL DEFAULT '{}',

  -- Sync configuration
  sync_enabled boolean NOT NULL DEFAULT true,
  sync_interval_minutes integer NOT NULL DEFAULT 360,
  last_sync_at timestamptz,
  last_sync_status sync_status,
  last_sync_error text,

  -- Scope
  database_year text,
  school_codes text[],

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  UNIQUE(district_id)
);


-- 2.2 ALTER existing schools table — add SIS columns
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS sis_school_id text,
  ADD COLUMN IF NOT EXISTS sis_connection_id uuid REFERENCES public.sis_connections(id),
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS principal_name text,
  ADD COLUMN IF NOT EXISTS grade_low text,
  ADD COLUMN IF NOT EXISTS grade_high text,
  ADD COLUMN IF NOT EXISTS school_type text;

CREATE INDEX IF NOT EXISTS idx_schools_sis
  ON public.schools(sis_connection_id, sis_school_id);


-- 2.3 students
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,

  -- SIS linkage
  sis_student_id text NOT NULL,
  state_student_id text,
  student_number text,

  -- Demographics
  last_name text NOT NULL,
  first_name text NOT NULL,
  middle_name text,
  gender text,
  birth_date date,
  grade_level text NOT NULL,

  -- Ethnicity / Race
  ethnicity_code text,
  race_codes text[],

  -- Language
  home_language_code text,
  language_fluency text,
  correspondence_language text,

  -- Address (mailing)
  address_street text,
  address_city text,
  address_state text,
  address_zip text,

  -- Status
  is_active boolean NOT NULL DEFAULT true,

  -- Metadata
  sis_raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(district_id, sis_student_id)
);

CREATE INDEX idx_students_school ON public.students(school_id) WHERE is_active = true;
CREATE INDEX idx_students_district ON public.students(district_id) WHERE is_active = true;
CREATE INDEX idx_students_name ON public.students(last_name, first_name);
CREATE INDEX idx_students_grade ON public.students(school_id, grade_level) WHERE is_active = true;


-- 2.4 enrollments
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  grade_level text NOT NULL,
  enter_date date NOT NULL,
  leave_date date,
  exit_reason_code text,
  attendance_program_code text,

  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id, school_id, academic_year, enter_date)
);

CREATE INDEX idx_enrollments_school_year
  ON public.enrollments(school_id, academic_year) WHERE leave_date IS NULL;


-- 2.5 contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL DEFAULT 0,

  last_name text NOT NULL,
  first_name text NOT NULL,
  relationship text,

  -- Contact methods
  home_phone text,
  work_phone text,
  cell_phone text,
  email text,

  -- Preferences
  correspondence_language text,
  notification_preference text,

  -- Rights
  is_educational_rights_holder boolean DEFAULT false,
  lives_with_student boolean DEFAULT false,
  is_emergency_contact boolean DEFAULT false,

  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id, sequence_number)
);

CREATE INDEX idx_contacts_student ON public.contacts(student_id);


-- 2.6 absence_code_maps
CREATE TABLE public.absence_code_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sis_connection_id uuid NOT NULL REFERENCES public.sis_connections(id) ON DELETE CASCADE,

  -- SIS-native code
  sis_code text NOT NULL,
  sis_description text,
  sis_type_id text,

  -- Canonical classification
  canonical_type absence_type NOT NULL,

  -- Funding and compliance flags
  counts_for_ada boolean NOT NULL DEFAULT true,
  counts_as_truancy boolean NOT NULL DEFAULT false,
  is_suspension boolean NOT NULL DEFAULT false,
  is_independent_study boolean NOT NULL DEFAULT false,

  -- Display
  display_name text NOT NULL,
  display_abbreviation text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(sis_connection_id, sis_code)
);


-- 2.7 school_calendars
CREATE TABLE public.school_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  calendar_date date NOT NULL,
  is_school_day boolean NOT NULL DEFAULT true,
  day_type text,
  attendance_month integer,
  notes text,

  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(school_id, calendar_date)
);

CREATE INDEX idx_school_calendars_lookup
  ON public.school_calendars(school_id, academic_year, calendar_date);


-- 2.8 attendance_daily
CREATE TABLE public.attendance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  calendar_date date NOT NULL,

  -- What the SIS recorded
  sis_absence_code text,
  absence_code_map_id uuid REFERENCES public.absence_code_maps(id),

  -- Canonical classification (denormalized for query speed)
  canonical_type absence_type NOT NULL DEFAULT 'present',
  counts_for_ada boolean NOT NULL DEFAULT true,
  counts_as_truancy boolean NOT NULL DEFAULT false,

  -- Period detail flag
  has_period_detail boolean NOT NULL DEFAULT false,

  -- Sync metadata
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id, calendar_date)
);

-- THE critical query: "all attendance for a school on a date"
CREATE INDEX idx_attendance_daily_school_date
  ON public.attendance_daily(school_id, calendar_date);

-- "all attendance for a student" (time series)
CREATE INDEX idx_attendance_daily_student
  ON public.attendance_daily(student_id, calendar_date DESC);

-- Funding queries: "all non-ADA days"
CREATE INDEX idx_attendance_daily_ada
  ON public.attendance_daily(school_id, calendar_date)
  WHERE counts_for_ada = false;

-- Truancy queries
CREATE INDEX idx_attendance_daily_truancy
  ON public.attendance_daily(student_id, calendar_date)
  WHERE counts_as_truancy = true;


-- 2.9 attendance_periods (optional detail)
CREATE TABLE public.attendance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_daily_id uuid NOT NULL REFERENCES public.attendance_daily(id) ON DELETE CASCADE,
  period_number integer NOT NULL,

  sis_absence_code text,
  absence_code_map_id uuid REFERENCES public.absence_code_maps(id),
  canonical_type absence_type NOT NULL DEFAULT 'present',

  section_number text,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(attendance_daily_id, period_number)
);


-- 2.10 attendance_snapshots
CREATE TABLE public.attendance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,

  -- Counts
  days_enrolled integer NOT NULL DEFAULT 0,
  days_present integer NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  days_absent_excused integer NOT NULL DEFAULT 0,
  days_absent_unexcused integer NOT NULL DEFAULT 0,
  days_tardy integer NOT NULL DEFAULT 0,
  days_truant integer NOT NULL DEFAULT 0,
  days_suspended integer NOT NULL DEFAULT 0,
  days_independent_study_complete integer NOT NULL DEFAULT 0,
  days_independent_study_incomplete integer NOT NULL DEFAULT 0,
  days_suspended_in_school integer NOT NULL DEFAULT 0,

  -- Computed rates
  attendance_rate numeric(5,2),
  ada_rate numeric(5,2),
  is_chronic_absent boolean NOT NULL DEFAULT false,

  -- Snapshot metadata
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  computed_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id, academic_year)
);

CREATE INDEX idx_attendance_snapshots_school
  ON public.attendance_snapshots(school_id, academic_year);
CREATE INDEX idx_attendance_snapshots_chronic
  ON public.attendance_snapshots(school_id, academic_year)
  WHERE is_chronic_absent = true;


-- 2.11 sis_sync_log
CREATE TABLE public.sis_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sis_connection_id uuid NOT NULL REFERENCES public.sis_connections(id) ON DELETE CASCADE,

  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status sync_status NOT NULL DEFAULT 'running',

  -- What was synced
  sync_type text NOT NULL,
  school_codes_synced text[],

  -- Results
  rows_fetched integer DEFAULT 0,
  rows_created integer DEFAULT 0,
  rows_updated integer DEFAULT 0,
  rows_errored integer DEFAULT 0,

  -- Error detail
  error_message text,
  error_detail jsonb,

  -- Performance
  duration_ms integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sis_sync_log_connection
  ON public.sis_sync_log(sis_connection_id, started_at DESC);


-- =============================================
-- 3. INTELLIGENCE LAYER TABLES
-- =============================================

-- 3.1 risk_signals
CREATE TABLE public.risk_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

  -- Signal state
  signal_level signal_level NOT NULL DEFAULT 'pending',
  signal_title text NOT NULL,
  signal_subtitle text,
  next_step text,

  -- Metrics that drove the signal
  attendance_rate numeric(5,2),
  consecutive_absences integer DEFAULT 0,
  total_days integer DEFAULT 0,
  last_30_rate numeric(5,2),
  previous_30_rate numeric(5,2),
  trend_delta numeric(5,2),

  -- Predictive
  predicted_year_end_rate numeric(5,2),
  predicted_chronic_risk_pct numeric(5,2),

  computed_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id)
);

CREATE INDEX idx_risk_signals_school_level
  ON public.risk_signals(school_id, signal_level);
CREATE INDEX idx_risk_signals_elevated
  ON public.risk_signals(school_id) WHERE signal_level = 'elevated';


-- 3.2 funding_projections
CREATE TABLE public.funding_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,

  -- Funding parameters
  per_pupil_daily_rate numeric(10,2),

  -- Student-level projection
  projected_absent_days integer,
  projected_ada_loss numeric(10,2),

  -- School-level aggregation (when student_id is null)
  total_students integer,
  total_chronic_absent integer,
  total_projected_loss numeric(12,2),

  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funding_school_year
  ON public.funding_projections(school_id, academic_year);


-- 3.3 compliance_cases
CREATE TABLE public.compliance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,

  current_tier compliance_tier NOT NULL DEFAULT 'none',

  -- Trigger counts
  unexcused_absence_count integer NOT NULL DEFAULT 0,
  truancy_count integer NOT NULL DEFAULT 0,
  total_absence_count integer NOT NULL DEFAULT 0,

  -- Tier transition timestamps
  tier_1_triggered_at timestamptz,
  tier_1_letter_sent_at timestamptz,
  tier_2_triggered_at timestamptz,
  tier_2_conference_date date,
  tier_3_triggered_at timestamptz,
  tier_3_referral_date date,

  -- Status
  is_resolved boolean NOT NULL DEFAULT false,
  resolution_notes text,
  resolved_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id, academic_year)
);


-- 3.4 intervention_log
CREATE TABLE public.intervention_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  compliance_case_id uuid REFERENCES public.compliance_cases(id),

  intervention_type text NOT NULL,
  intervention_date date NOT NULL,

  -- Detail
  description text,
  outcome text,

  -- Who did it
  performed_by uuid REFERENCES auth.users(id),
  performed_by_name text,

  -- Effectiveness tracking
  attendance_rate_before numeric(5,2),
  attendance_rate_after_30d numeric(5,2),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intervention_student
  ON public.intervention_log(student_id, intervention_date DESC);


-- =============================================
-- 4. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.sis_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_code_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sis_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_log ENABLE ROW LEVEL SECURITY;

-- sis_connections: district-level, use join through schools + staff_memberships
CREATE POLICY "District staff can read sis_connections"
  ON public.sis_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.schools s
      JOIN public.staff_memberships sm ON sm.school_id = s.id
      WHERE s.district_id = sis_connections.district_id
        AND sm.user_id = auth.uid()
        AND sm.is_active = true
    )
  );

-- Tables with school_id: use is_active_staff()
CREATE POLICY "Staff can read students"
  ON public.students FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can read enrollments"
  ON public.enrollments FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

-- contacts: join through students to get school_id
CREATE POLICY "Staff can read contacts"
  ON public.contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = contacts.student_id
        AND public.is_active_staff(auth.uid(), s.school_id)
    )
  );

-- absence_code_maps: join through sis_connections to district, then schools + staff
CREATE POLICY "District staff can read absence_code_maps"
  ON public.absence_code_maps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sis_connections sc
      JOIN public.schools s ON s.district_id = sc.district_id
      JOIN public.staff_memberships sm ON sm.school_id = s.id
      WHERE sc.id = absence_code_maps.sis_connection_id
        AND sm.user_id = auth.uid()
        AND sm.is_active = true
    )
  );

CREATE POLICY "Staff can read school_calendars"
  ON public.school_calendars FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can read attendance_daily"
  ON public.attendance_daily FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

-- attendance_periods: join through attendance_daily
CREATE POLICY "Staff can read attendance_periods"
  ON public.attendance_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_daily ad
      WHERE ad.id = attendance_periods.attendance_daily_id
        AND public.is_active_staff(auth.uid(), ad.school_id)
    )
  );

CREATE POLICY "Staff can read attendance_snapshots"
  ON public.attendance_snapshots FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

-- sis_sync_log: join through sis_connections to district
CREATE POLICY "District staff can read sis_sync_log"
  ON public.sis_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sis_connections sc
      JOIN public.schools s ON s.district_id = sc.district_id
      JOIN public.staff_memberships sm ON sm.school_id = s.id
      WHERE sc.id = sis_sync_log.sis_connection_id
        AND sm.user_id = auth.uid()
        AND sm.is_active = true
    )
  );

CREATE POLICY "Staff can read risk_signals"
  ON public.risk_signals FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can read funding_projections"
  ON public.funding_projections FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can read compliance_cases"
  ON public.compliance_cases FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

CREATE POLICY "Staff can read intervention_log"
  ON public.intervention_log FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));


-- =============================================
-- 5. UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_sis_connections_updated_at
  BEFORE UPDATE ON public.sis_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_absence_code_maps_updated_at
  BEFORE UPDATE ON public.absence_code_maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_daily_updated_at
  BEFORE UPDATE ON public.attendance_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_cases_updated_at
  BEFORE UPDATE ON public.compliance_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
