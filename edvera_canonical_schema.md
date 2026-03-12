# Edvera Canonical Schema v1.0

## Reference Document for All Claude Code Sessions

**Purpose**: This document defines Edvera's SIS-agnostic database schema. Every table uses Edvera's own field names. SIS-specific field names never appear in the canonical schema. Each SIS connector translates from its native format into this canonical format.

**Architecture**: `SIS API → Connector (adapter) → Canonical Schema → Intelligence Engines → UI`

**Stack**: Supabase (Postgres), Row Level Security, Edge Functions, React + TypeScript + Vite

---

## 1. Schema Overview

### Table Hierarchy

```
districts
  └── sis_connections          (one per district, defines which SIS + credentials)
  └── schools
        └── school_calendars   (instructional days, holidays, PD days)
        └── bell_schedules → bell_blocks
        └── absence_code_maps  (district's SIS codes → canonical flags)
        └── students
              └── enrollments  (which school, which year, enter/leave)
              └── contacts     (parent/guardian with language, notification pref)
              └── attendance_daily   (one row per student per instructional day)
              └── attendance_periods (optional: period-level detail)
        └── attendance_snapshots    (rolled-up stats per student per term)
  
  sis_sync_log                 (tracks every sync run: what was pulled, errors, row counts)
  
  --- Intelligence Layer (reads canonical, never touches SIS) ---
  risk_signals                 (computed signal per student: stable/softening/elevated)
  funding_projections          (per-student and per-school ADA loss estimates)
  compliance_cases             (SARB tier tracking, intervention ladder)
  intervention_log             (what was done, when, by whom, outcome)
```

### Enum Types

```sql
-- SIS platform identifiers
CREATE TYPE sis_platform AS ENUM (
  'aeries',
  'powerschool', 
  'infinite_campus',
  'skyward',
  'synergy',
  'csv_upload'     -- universal fallback
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

-- Risk signal levels (from existing attendanceSignal.ts)
CREATE TYPE signal_level AS ENUM (
  'pending',
  'stable',
  'softening',
  'elevated'
);

-- SARB compliance tiers (California)
CREATE TYPE compliance_tier AS ENUM (
  'none',
  'tier_1_letter',      -- 3+ unexcused absences
  'tier_2_conference',   -- 5+ unexcused absences  
  'tier_3_sarb_referral' -- 10+ unexcused or 20% absence rate
);
```

---

## 2. Canonical Tables — DDL

### 2.1 `sis_connections`

One row per district. Stores which SIS platform they use and how to connect.

```sql
CREATE TABLE public.sis_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  platform sis_platform NOT NULL,
  display_name text NOT NULL,              -- "Aeries - Pacific USD"
  
  -- Connection config (encrypted at rest via Supabase Vault)
  base_url text,                           -- e.g. "https://demo.aeries.net/aeries"
  auth_config jsonb NOT NULL DEFAULT '{}', -- platform-specific auth blob
  -- Aeries:   { "certificate": "XXXXX" }
  -- PowerSchool: { "client_id": "...", "client_secret": "...", "plugin_access_token": "..." }
  -- Infinite Campus: { "consumer_key": "...", "consumer_secret": "...", "token_url": "..." }
  -- CSV: {}
  
  -- Sync configuration
  sync_enabled boolean NOT NULL DEFAULT true,
  sync_interval_minutes integer NOT NULL DEFAULT 360,  -- default 6 hours
  last_sync_at timestamptz,
  last_sync_status sync_status,
  last_sync_error text,
  
  -- Scope
  database_year text,                      -- Aeries: "2025-2026", PowerSchool: year ID
  school_codes text[],                     -- if null, sync all schools in district
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  UNIQUE(district_id)  -- one connection per district for now
);
```

### 2.2 `schools` (MODIFY EXISTING)

Add SIS-linkage columns to existing schools table.

```sql
-- Additive migration on existing public.schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS sis_school_id text,      -- school code in SIS (Aeries: "101", PS: "1")
  ADD COLUMN IF NOT EXISTS sis_connection_id uuid REFERENCES public.sis_connections(id),
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS principal_name text,
  ADD COLUMN IF NOT EXISTS grade_low text,          -- e.g. "K", "-1" (TK), "6"
  ADD COLUMN IF NOT EXISTS grade_high text,         -- e.g. "5", "8", "12"
  ADD COLUMN IF NOT EXISTS school_type text;        -- 'elementary', 'middle', 'high', 'k8', 'continuation'

CREATE INDEX IF NOT EXISTS idx_schools_sis 
  ON public.schools(sis_connection_id, sis_school_id);
```

### 2.3 `students`

The canonical student record. No SIS-specific field names.

```sql
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  
  -- SIS linkage
  sis_student_id text NOT NULL,           -- Aeries: StudentID, PS: student.id, IC: sourcedId
  state_student_id text,                  -- CA: SSID (10-digit), varies by state
  student_number text,                    -- local student number (may differ from sis_student_id)
  
  -- Demographics
  last_name text NOT NULL,
  first_name text NOT NULL,
  middle_name text,
  gender text,                            -- 'M', 'F', 'X', 'N' (non-binary)
  birth_date date,
  grade_level text NOT NULL,              -- canonical: "TK","-1","K","0","1".."12","UG"
  
  -- Ethnicity / Race (CA reporting categories)
  ethnicity_code text,                    -- Hispanic/Latino indicator
  race_codes text[],                      -- array of race codes  
  
  -- Language
  home_language_code text,                -- ISO 639 or state code
  language_fluency text,                  -- 'EO','IFEP','EL','RFEP','TBD'
  correspondence_language text,           -- preferred communication language
  
  -- Address (mailing)
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  
  -- Metadata
  sis_raw_data jsonb,                     -- full SIS response for debugging (optional)
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- A student is unique per SIS ID within a district
  UNIQUE(district_id, sis_student_id)
);

CREATE INDEX idx_students_school ON public.students(school_id) WHERE is_active = true;
CREATE INDEX idx_students_district ON public.students(district_id) WHERE is_active = true;
CREATE INDEX idx_students_name ON public.students(last_name, first_name);
CREATE INDEX idx_students_grade ON public.students(school_id, grade_level) WHERE is_active = true;
```

### 2.4 `enrollments`

Tracks which school a student is enrolled at, with dates. Supports transfers and multi-year history.

```sql
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,            -- "2025-2026"
  grade_level text NOT NULL,
  enter_date date NOT NULL,
  leave_date date,                        -- null = still enrolled
  exit_reason_code text,
  attendance_program_code text,           -- Aeries: SP field, used for ADA calculations
  
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(student_id, school_id, academic_year, enter_date)
);

CREATE INDEX idx_enrollments_school_year 
  ON public.enrollments(school_id, academic_year) WHERE leave_date IS NULL;
```

### 2.5 `contacts`

Parent/guardian contact records per student.

```sql
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL DEFAULT 0,  -- priority order
  
  last_name text NOT NULL,
  first_name text NOT NULL,
  relationship text,                      -- 'MO','FA','GU','GR','OT' → stored as canonical
  
  -- Contact methods
  home_phone text,
  work_phone text,
  cell_phone text,
  email text,
  
  -- Preferences  
  correspondence_language text,           -- preferred language for outreach
  notification_preference text,           -- 'T'=text, 'E'=email, 'B'=both, 'N'=none
  
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
```

### 2.6 `absence_code_maps`

Maps a district's SIS-native absence codes to canonical boolean properties. This is the critical translation table that makes the intelligence layer SIS-agnostic.

```sql
CREATE TABLE public.absence_code_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sis_connection_id uuid NOT NULL REFERENCES public.sis_connections(id) ON DELETE CASCADE,
  
  -- SIS-native code (what comes from the API)
  sis_code text NOT NULL,                 -- Aeries: "A","E","U","T", PS: "ABS","EXC"
  sis_description text,                   -- "Unverified Absence"
  sis_type_id text,                       -- Aeries: ABS.TY value
  
  -- Canonical classification (what Edvera engines use)
  canonical_type absence_type NOT NULL,
  
  -- Funding and compliance flags (THE critical booleans)
  counts_for_ada boolean NOT NULL DEFAULT true,    -- student present for funding?
  counts_as_truancy boolean NOT NULL DEFAULT false, -- toward truancy count?
  is_suspension boolean NOT NULL DEFAULT false,
  is_independent_study boolean NOT NULL DEFAULT false,
  
  -- Display
  display_name text NOT NULL,             -- Edvera's label: "Unverified Absence"
  display_abbreviation text,              -- "UNV"
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(sis_connection_id, sis_code)
);
```

### 2.7 `school_calendars`

Which days are instructional days for each school. Required for accurate enrolled-day counts and ADA calculations.

```sql
CREATE TABLE public.school_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,            -- "2025-2026"
  calendar_date date NOT NULL,
  is_school_day boolean NOT NULL DEFAULT true,
  day_type text,                          -- 'regular','minimum','holiday','pd_day','break'
  attendance_month integer,               -- 1-12, for ADA reporting periods
  notes text,
  
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(school_id, calendar_date)
);

CREATE INDEX idx_school_calendars_lookup 
  ON public.school_calendars(school_id, academic_year, calendar_date);
```

### 2.8 `attendance_daily`

One row per student per instructional day. The core attendance fact table.

```sql
CREATE TABLE public.attendance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  calendar_date date NOT NULL,
  
  -- What the SIS recorded
  sis_absence_code text,                  -- raw code from SIS: "A", "E", "T", null (present)
  absence_code_map_id uuid REFERENCES public.absence_code_maps(id),
  
  -- Canonical classification (denormalized from absence_code_maps for query speed)
  canonical_type absence_type NOT NULL DEFAULT 'present',
  counts_for_ada boolean NOT NULL DEFAULT true,
  counts_as_truancy boolean NOT NULL DEFAULT false,
  
  -- Period detail flag (if period-level data exists in attendance_periods)
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
```

### 2.9 `attendance_periods` (optional detail)

Period-by-period attendance for secondary schools. Only populated when the SIS provides period-level data.

```sql
CREATE TABLE public.attendance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_daily_id uuid NOT NULL REFERENCES public.attendance_daily(id) ON DELETE CASCADE,
  period_number integer NOT NULL,
  
  sis_absence_code text,
  absence_code_map_id uuid REFERENCES public.absence_code_maps(id),
  canonical_type absence_type NOT NULL DEFAULT 'present',
  
  section_number text,                    -- class/section identifier from SIS
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(attendance_daily_id, period_number)
);
```

### 2.10 `attendance_snapshots`

Rolled-up attendance statistics per student per term. Computed by Edvera (not from SIS), but can be seeded from SIS history tables (Aeries AHS).

```sql
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
  attendance_rate numeric(5,2),           -- (present / enrolled) * 100
  ada_rate numeric(5,2),                  -- (ada_qualifying / enrolled) * 100
  is_chronic_absent boolean NOT NULL DEFAULT false,  -- attendance_rate < 90
  
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
```

### 2.11 `sis_sync_log`

Audit trail for every sync operation.

```sql
CREATE TABLE public.sis_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sis_connection_id uuid NOT NULL REFERENCES public.sis_connections(id) ON DELETE CASCADE,
  
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status sync_status NOT NULL DEFAULT 'running',
  
  -- What was synced
  sync_type text NOT NULL,                -- 'full', 'incremental', 'attendance_only', 'students_only'
  school_codes_synced text[],
  
  -- Results
  rows_fetched integer DEFAULT 0,
  rows_created integer DEFAULT 0,
  rows_updated integer DEFAULT 0,
  rows_errored integer DEFAULT 0,
  
  -- Error detail
  error_message text,
  error_detail jsonb,                     -- stack trace, failed records, etc.
  
  -- Performance
  duration_ms integer,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sis_sync_log_connection 
  ON public.sis_sync_log(sis_connection_id, started_at DESC);
```

---

## 3. Intelligence Layer Tables

These tables are computed by Edvera engines. They read from the canonical schema and never interact with SIS APIs directly.

### 3.1 `risk_signals`

Computed risk signal per student. Replaces the client-side `buildAttendanceSignal()`.

```sql
CREATE TABLE public.risk_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  
  -- Signal state (from attendanceSignal.ts state machine)
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
  
  -- Predictive (future: ML model scores)
  predicted_year_end_rate numeric(5,2),
  predicted_chronic_risk_pct numeric(5,2),  -- probability of becoming chronic
  
  computed_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(student_id)  -- one current signal per student
);

CREATE INDEX idx_risk_signals_school_level 
  ON public.risk_signals(school_id, signal_level);
CREATE INDEX idx_risk_signals_elevated 
  ON public.risk_signals(school_id) WHERE signal_level = 'elevated';
```

### 3.2 `funding_projections`

Per-student and per-school ADA funding impact estimates.

```sql
CREATE TABLE public.funding_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,  -- null for school-level
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  
  -- Funding parameters
  per_pupil_daily_rate numeric(10,2),     -- ADA funding per day (varies by district/program)
  
  -- Student-level projection
  projected_absent_days integer,
  projected_ada_loss numeric(10,2),       -- dollars lost for this student
  
  -- School-level aggregation (when student_id is null)
  total_students integer,
  total_chronic_absent integer,
  total_projected_loss numeric(12,2),
  
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funding_school_year 
  ON public.funding_projections(school_id, academic_year);
```

### 3.3 `compliance_cases`

SARB compliance tracking. One case per student per academic year.

```sql
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
```

### 3.4 `intervention_log`

What actions were taken for each student. Links to compliance cases.

```sql
CREATE TABLE public.intervention_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  compliance_case_id uuid REFERENCES public.compliance_cases(id),
  
  intervention_type text NOT NULL,        -- 'phone_call','letter','home_visit','conference','sarb_referral','automated_notification'
  intervention_date date NOT NULL,
  
  -- Detail
  description text,
  outcome text,                           -- 'no_response','parent_contacted','meeting_scheduled','attendance_improved'
  
  -- Who did it
  performed_by uuid REFERENCES auth.users(id),
  performed_by_name text,
  
  -- Effectiveness tracking
  attendance_rate_before numeric(5,2),
  attendance_rate_after_30d numeric(5,2), -- measured 30 days later
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intervention_student 
  ON public.intervention_log(student_id, intervention_date DESC);
```

---

## 4. Aeries Connector Mapping

### 4.1 Authentication

Aeries uses a simple certificate-based auth. The certificate is a 32-character alphanumeric string passed in the `APTS` header.

```
auth_config = { "certificate": "477abe9e7d27439681d62f4e0de1f5e1" }
base_url = "https://demo.aeries.net/aeries"
```

Every API call:
```
GET {base_url}/api/v5/{endpoint}
Header: APTS: {certificate}
Accept: application/json
```

### 4.2 Field Mapping: Students

| Aeries Field | Canonical Field | Notes |
|---|---|---|
| `StudentID` | `sis_student_id` | Primary key in Aeries |
| `StateStudentID` | `state_student_id` | CA SSID |
| `StudentNumber` | `student_number` | Local number |
| `LastName` | `last_name` | |
| `FirstName` | `first_name` | |
| `MiddleName` | `middle_name` | |
| `Gender` | `gender` | 'M','F' |
| `Grade` | `grade_level` | Aeries: -1=TK, 0=K, 1-12. Map -1→"TK", 0→"K" |
| `Birthdate` | `birth_date` | ISO 8601 datetime → date |
| `SchoolCode` | → look up school by `sis_school_id` | |
| `EthnicityCode` | `ethnicity_code` | 'H'=Hispanic, 'N'=Not |
| `RaceCode1..5` | `race_codes` | Collect into array, filter nulls |
| `HomeLanguageCode` | `home_language_code` | |
| `LanguageFluencyCode` | `language_fluency` | Map: 'E'→'EO','L'→'EL','R'→'RFEP','I'→'IFEP','T'→'TBD' |
| `CorrespondenceLanguageCode` | `correspondence_language` | '00'=English,'01'=Spanish, etc |
| `MailingAddress` | `address_street` | |
| `MailingAddressCity` | `address_city` | |
| `MailingAddressState` | `address_state` | |
| `MailingAddressZipCode` | `address_zip` | |
| `InactiveStatusCode` | `is_active` | '0' or '' → true, else false |
| `FamilyKey` | (used to link contacts) | |

**Aeries API endpoint**: `GET /api/v5/schools/{SchoolCode}/students`

### 4.3 Field Mapping: Contacts

| Aeries Field | Canonical Field | Notes |
|---|---|---|
| `StudentID` | → look up student | |
| `SequenceNumber` | `sequence_number` | |
| `LastName` | `last_name` | |
| `FirstName` | `first_name` | |
| `RelationshipToStudentCode` | `relationship` | Store as-is |
| `HomePhone` | `home_phone` | |
| `WorkPhone` | `work_phone` | |
| `CellPhone` | `cell_phone` | |
| `EmailAddress` | `email` | |
| `CorrespondenceLanguageCode` | `correspondence_language` | |
| `NotificationPreferenceCode` | `notification_preference` | 'T','E','B' |
| `EducationalRightsHolder` | `is_educational_rights_holder` | 'Y'→true |
| `LivesWithStudentIndicator` | `lives_with_student` | 'Y'→true |

**Aeries API endpoint**: `GET /api/v5/schools/{SchoolCode}/students/{StudentID}/contacts`

### 4.4 Field Mapping: Attendance Daily

| Aeries Field | Canonical Field | Notes |
|---|---|---|
| `StudentID` | → look up student | |
| `SchoolCode` | → look up school | |
| `CalendarDate` | `calendar_date` | ISO datetime → date |
| `AllDayAttendanceCode` | `sis_absence_code` | null or '' = present |
| (period array) | → `attendance_periods` | If period data exists |

**Aeries API endpoint**: `GET /api/v5/schools/{SchoolCode}/attendance/{StudentID}`

**Present vs Absent logic**: In Aeries, a blank/null `AllDayAttendanceCode` means present. Any non-empty code references the absence_codes table.

### 4.5 Field Mapping: Absence Codes

| Aeries Field | Canonical Field | Notes |
|---|---|---|
| `Code` | `sis_code` | |
| `Description` | `sis_description` | |
| `TypeID` | `sis_type_id` | |
| `TypeName` | (reference only) | |
| `CountForADA` | `counts_for_ada` | Direct boolean map |
| `TruancyFlag` | `counts_as_truancy` | Direct boolean map |
| `Suspension` | `is_suspension` | Direct boolean map |
| `IndependentStudy` | `is_independent_study` | Direct boolean map |

**Canonical type mapping from Aeries TypeID**:

| Aeries TypeID | TypeName | → `canonical_type` |
|---|---|---|
| 1 | Unverified Absence | `absent_unverified` |
| 2 | Excused Absence Verified | `absent_excused` |
| 3 | Unexcused Absence Verified | `absent_unexcused` |
| 5 | Tardy | `tardy` |
| 6 | Present | `present` |
| 8 | Excused Tardy | `tardy_excused` |
| 9 | Unexcused Tardy Verified | `tardy_unexcused` |

Plus special cases for suspension codes (check `Suspension` flag) and independent study codes (check `IndependentStudy` field).

**Aeries API endpoint**: `GET /api/v5/schools/{SchoolCode}/AbsenceCodes`

### 4.6 Field Mapping: Enrollment

| Aeries Field | Canonical Field | Notes |
|---|---|---|
| `StudentID` | → look up student | |
| `SchoolCode` | → look up school | |
| `Grade` | `grade_level` | Same mapping as students |
| `SchoolEnterDate` | `enter_date` | |
| `SchoolLeaveDate` | `leave_date` | null = still enrolled |
| `AttendanceProgramCodePrimary` | `attendance_program_code` | |

**Aeries API endpoint**: `GET /api/v5/enrollment/{StudentID}` (with `?DatabaseYear=YYYY` for history)

### 4.7 Field Mapping: School Calendar

| Aeries Field | Canonical Field | Notes |
|---|---|---|
| `SchoolCode` | → look up school | |
| `Date` | `calendar_date` | |
| `IsSchoolDay` | `is_school_day` | |
| `DayType` | `day_type` | Map to canonical types |
| `AttendanceMonth` | `attendance_month` | |

**Aeries API endpoint**: `GET /api/v5/schools/{SchoolCode}/calendar`

### 4.8 Field Mapping: Attendance History (AHS → attendance_snapshots)

| Aeries AHS Field | Canonical Field | Notes |
|---|---|---|
| `ID` (StudentID) | → look up student | |
| `YR` | `academic_year` | |
| `SCL` | → look up school | |
| `EN` | `days_enrolled` | |
| `PR` | `days_present` | |
| `AB` | `days_absent` | |
| `AE` | `days_absent_excused` | |
| `AU` | `days_absent_unexcused` | |
| `TD` | `days_tardy` | |
| `TRU` | `days_truant` | |
| `SU` | `days_suspended` | Out-of-school |
| `ISC` | `days_independent_study_complete` | |
| `ISI` | `days_independent_study_incomplete` | |
| `ISS` | `days_suspended_in_school` | |
| (computed) | `attendance_rate` | `(PR / EN) * 100` |
| (computed) | `is_chronic_absent` | `attendance_rate < 90` |

---

## 5. Connector Interface (TypeScript)

Every SIS connector implements this interface. The Aeries connector is the first implementation.

```typescript
/**
 * SIS Connector Interface
 * Each SIS platform implements this interface.
 * The sync orchestrator calls these methods and writes results to canonical tables.
 */
export interface SISConnector {
  platform: SISPlatform;
  
  // Test connectivity and permissions
  testConnection(): Promise<ConnectionTestResult>;
  
  // Sync operations — each returns canonical-format records
  syncAbsenceCodes(schoolCode: string): Promise<CanonicalAbsenceCode[]>;
  syncStudents(schoolCode: string): Promise<CanonicalStudent[]>;
  syncContacts(schoolCode: string, studentIds: string[]): Promise<CanonicalContact[]>;
  syncAttendance(schoolCode: string, startDate: string, endDate?: string): Promise<CanonicalAttendanceDay[]>;
  syncEnrollments(schoolCode: string): Promise<CanonicalEnrollment[]>;
  syncCalendar(schoolCode: string, academicYear: string): Promise<CanonicalCalendarDay[]>;
  
  // Optional: bulk history import (Aeries AHS table)
  syncAttendanceHistory?(schoolCode: string, academicYear: string): Promise<CanonicalAttendanceSnapshot[]>;
}

export type SISPlatform = 'aeries' | 'powerschool' | 'infinite_campus' | 'skyward' | 'synergy' | 'csv_upload';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  schools?: { code: string; name: string }[];
}

// Canonical types that connectors return (SIS-agnostic)

export interface CanonicalStudent {
  sis_student_id: string;
  state_student_id?: string;
  student_number?: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  gender?: string;
  birth_date?: string;         // ISO date
  grade_level: string;         // "TK","K","1".."12"
  ethnicity_code?: string;
  race_codes?: string[];
  home_language_code?: string;
  language_fluency?: string;
  correspondence_language?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  is_active: boolean;
  sis_raw_data?: Record<string, unknown>;
}

export interface CanonicalContact {
  sis_student_id: string;
  sequence_number: number;
  last_name: string;
  first_name: string;
  relationship?: string;
  home_phone?: string;
  work_phone?: string;
  cell_phone?: string;
  email?: string;
  correspondence_language?: string;
  notification_preference?: string;
  is_educational_rights_holder: boolean;
  lives_with_student: boolean;
}

export interface CanonicalAbsenceCode {
  sis_code: string;
  sis_description?: string;
  sis_type_id?: string;
  canonical_type: AbsenceType;
  counts_for_ada: boolean;
  counts_as_truancy: boolean;
  is_suspension: boolean;
  is_independent_study: boolean;
  display_name: string;
  display_abbreviation?: string;
}

export interface CanonicalAttendanceDay {
  sis_student_id: string;
  sis_school_id: string;
  calendar_date: string;       // ISO date
  sis_absence_code: string | null;  // null = present
  periods?: {
    period_number: number;
    sis_absence_code: string | null;
    section_number?: string;
  }[];
}

export interface CanonicalEnrollment {
  sis_student_id: string;
  sis_school_id: string;
  academic_year: string;
  grade_level: string;
  enter_date: string;
  leave_date?: string;
  exit_reason_code?: string;
  attendance_program_code?: string;
}

export interface CanonicalCalendarDay {
  sis_school_id: string;
  calendar_date: string;
  is_school_day: boolean;
  day_type?: string;
  attendance_month?: number;
}

export interface CanonicalAttendanceSnapshot {
  sis_student_id: string;
  sis_school_id: string;
  academic_year: string;
  days_enrolled: number;
  days_present: number;
  days_absent: number;
  days_absent_excused: number;
  days_absent_unexcused: number;
  days_tardy: number;
  days_truant: number;
  days_suspended: number;
  days_independent_study_complete: number;
  days_independent_study_incomplete: number;
  days_suspended_in_school: number;
}

export type AbsenceType = 
  | 'present'
  | 'absent_unverified'
  | 'absent_excused'
  | 'absent_unexcused'
  | 'tardy'
  | 'tardy_excused'
  | 'tardy_unexcused'
  | 'suspension_in_school'
  | 'suspension_out_of_school'
  | 'independent_study_complete'
  | 'independent_study_incomplete'
  | 'not_enrolled';
```

---

## 6. Migration Strategy: Current → Canonical

### What exists today (to preserve or deprecate)

| Current Table | Action | Notes |
|---|---|---|
| `districts` | **KEEP** | Add columns via ALTER |
| `schools` | **KEEP + ALTER** | Add SIS columns |
| `children` | **DEPRECATE** | Parent-app concept. Replace with `students` for admin. Keep for parent app backward compat. |
| `attendance_entries` | **DEPRECATE** | Parent-submitted. Replace with `attendance_daily` (SIS-sourced). |
| `attendance_triage` | **KEEP + MODIFY** | Link to `students` instead of `children`. This is Edvera-native, not SIS data. |
| `bell_schedules` / `bell_blocks` | **KEEP** | Already SIS-agnostic |
| `day_overrides` | **KEEP** | Edvera-native |
| `school_events` | **KEEP** | Edvera-native |
| `staff_memberships` | **KEEP** | Auth/access control |
| `school_profiles` | **KEEP** | Edvera-native |
| `announcements` | **KEEP** | Edvera-native |
| `audit_log` | **KEEP** | Extend to track SIS sync events |
| `documents` / `document_chunks` / `document_outputs` | **KEEP** | Document workstation |
| `profiles` / `memberships` | **KEEP** | Auth |
| `board_meetings` / `district_sources` / `legal_pages` | **KEEP** | District info |
| `ingestion_runs` | **KEEP** | Generalize for SIS sync |
| `todos` / `notes` | **KEEP** | Admin tools |

### Migration order

1. Create enum types
2. Create `sis_connections` table
3. ALTER `schools` to add SIS columns
4. Create `students` table (parallel to `children`, does NOT replace it yet)
5. Create `contacts` table
6. Create `absence_code_maps` table
7. Create `school_calendars` table
8. Create `attendance_daily` table
9. Create `attendance_periods` table
10. Create `attendance_snapshots` table
11. Create `sis_sync_log` table
12. Create intelligence layer tables (`risk_signals`, `funding_projections`, `compliance_cases`, `intervention_log`)
13. Add RLS policies for all new tables

### RLS Pattern

All new tables use the existing `is_active_staff()` function for admin access, scoped by `school_id`:

```sql
-- Standard RLS for canonical tables
ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read {table}"
  ON public.{table} FOR SELECT
  USING (public.is_active_staff(auth.uid(), school_id));

-- For district-level tables (sis_connections):
CREATE POLICY "District staff can read connections"
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
```

---

## 7. Sync Orchestration Flow

```
1. Scheduler triggers sync for sis_connection_id
2. Create sis_sync_log row (status: 'running')
3. Load SIS connector based on platform type
4. For each school_code in connection scope:
   a. syncAbsenceCodes() → UPSERT absence_code_maps
   b. syncStudents() → UPSERT students
   c. syncContacts() → UPSERT contacts  
   d. syncCalendar() → UPSERT school_calendars
   e. syncAttendance(last_sync_date) → UPSERT attendance_daily
      - For each day: look up absence_code_map → set canonical_type + flags
   f. syncEnrollments() → UPSERT enrollments
5. Recompute attendance_snapshots for affected students
6. Recompute risk_signals for affected students
7. Recompute funding_projections for affected schools
8. Update compliance_cases if thresholds crossed
9. Update sis_sync_log (status: 'completed', row counts)
10. Update sis_connections.last_sync_at
```

---

## 8. Claude Code Prompt Sequence

Use this exact sequence. Each prompt should include this document as context plus the specific files mentioned.

### Prompt 1: Schema Migration
**Input**: This document (Section 2 DDL), current migration files list
**Task**: Generate a single Supabase migration SQL file that creates all enum types and all new tables from Section 2, with RLS policies. Additive only — do not drop or modify existing tables except the ALTER on `schools`.
**Output**: `supabase/migrations/YYYYMMDD_canonical_schema.sql`

### Prompt 2: Seed Synthetic Data
**Input**: This document (Section 4 mappings), synthetic CSV files, migration from Prompt 1
**Task**: Generate a Supabase seed script that loads synthetic data into canonical tables. Map from Aeries-format CSVs to canonical format using the field mappings.
**Output**: `supabase/seed.sql` or `scripts/seed_canonical.ts`

### Prompt 3: Aeries Connector
**Input**: This document (Section 4 + 5), Aeries API documentation notes
**Task**: Implement `AeriesConnector` class that implements the `SISConnector` interface. Edge Function that accepts connection config and returns canonical-format records.
**Output**: `supabase/functions/sis-connector-aeries/index.ts`

### Prompt 4: Sync Orchestrator
**Input**: This document (Section 7), connector from Prompt 3, schema from Prompt 1
**Task**: Implement sync orchestrator Edge Function. Reads from `sis_connections`, instantiates correct connector, runs sync flow, writes to canonical tables, updates `sis_sync_log`.
**Output**: `supabase/functions/sis-sync/index.ts`

### Prompt 5: Refactor Metrics Engine
**Input**: This document, current `attendanceMetrics.ts` and `attendanceSignal.ts`, new schema
**Task**: Move computation to Edge Function. Read from `attendance_daily`, compute metrics, write to `risk_signals` and `attendance_snapshots`. Keep same algorithm, new data source.
**Output**: `supabase/functions/compute-signals/index.ts`

### Prompt 6: Refactor Admin Dashboard
**Input**: Current admin dashboard components, new schema
**Task**: Update admin triage view to read from `students` + `attendance_daily` + `risk_signals` instead of `children` + `attendance_entries`. Same UI, new data source.
**Output**: Updated React components

---

## 9. Future Connector Notes

### PowerSchool
- Auth: OAuth 2.0 bearer tokens (client_id + client_secret → access_token)
- Students: `GET /ws/v1/school/{id}/student` with expansions
- Attendance: PowerQueries (custom SQL exposed via API), or `GET /ws/v1/school/{id}/attendance`
- Plugin framework required for some data access
- Field mapping differences: `student.id`, `name.first_name`, `name.last_name`, `demographics.gender`, `school_enrollment.grade_level`

### Infinite Campus
- Auth: OneRoster 1.1/1.2 with OAuth 2.0 (consumer_key + consumer_secret)
- **Critical limitation**: OneRoster does NOT include attendance data
- Requires partnership-level API access for attendance, OR
- SFTP/CSV export as fallback
- Students available via OneRoster Users endpoint
- Enrollment via OneRoster Enrollments endpoint

### Skyward
- Auth: API key based
- Attendance available via native API (not OneRoster)
- Similar structure to Aeries (student, attendance, absence codes)

### CSV Upload (Universal Fallback)
- Platform: 'csv_upload'
- No API — user uploads attendance export from any SIS
- Guided column mapping UI: user maps their columns to canonical fields
- Stored in `sis_connections` with `auth_config: {}`
- Sync is manual (triggered by file upload, not scheduled)
```
