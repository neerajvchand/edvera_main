# SART/Root Cause Workflow Implementation Plan

## Overview

Extend the compliance case workflow with Root Cause Assessment and SART (School Attendance Review Team) steps that gate tier progression. This adds 5 new workflow steps alongside the 3 existing ones, creating an 8-step sequence across 3 tiers.

---

## Phase 1: Database Migration (`20260312002_sart_workflow.sql`)

**File:** `supabase/migrations/20260312002_sart_workflow.sql`

```sql
ALTER TABLE compliance_cases
  ADD COLUMN IF NOT EXISTS root_cause JSONB,
  ADD COLUMN IF NOT EXISTS sart_data JSONB;

ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS toolkit_url TEXT,
  ADD COLUMN IF NOT EXISTS toolkit_name TEXT;
```

- `root_cause` JSONB stores the checkbox-grid root cause assessment (categories + notes + narrative)
- `sart_data` JSONB stores the SART referral data (trigger, date, prior_interventions, referred_by)
- `intervention_log` already exists with `intervention_type` field — we'll use `'sart_meeting'` and `'sart_followup'` types
- `actions` table already exists — we'll use `action_type = 'sart_action'` for SART action plan items
- `toolkit_url` / `toolkit_name` on districts for county SART toolkit link

No new tables needed.

---

## Phase 2: Type Definitions

**File:** `console/src/types/caseWorkspace.ts`

Add to `CaseWorkspaceResponse`:
```ts
// Add to case object:
rootCauseAssessment: RootCauseAssessment | null;
sartData: SartReferralData | null;

// New top-level fields:
sartMeeting: SartMeetingRecord | null;
sartFollowup: SartFollowupRecord | null;
sartActionPlan: SartActionItem[];
districtToolkit: { url: string; name: string } | null;
```

New types:
```ts
interface RootCauseAssessment {
  categories: Record<string, { checked: boolean; notes: string }>;
  narrative: string;
  savedAt: string | null;
  savedBy: string | null;
}

interface SartReferralData {
  referral_trigger: string;
  referral_date: string;
  prior_informal_interventions: string;
  referred_by: string;
  savedAt: string | null;
}

interface SartMeetingRecord {
  id: string;
  meeting_date: string;
  attendees: string[];
  family_present: boolean;
  agenda_checklist: Record<string, boolean>;
  outcome: string;
  notes: string;
  createdAt: string;
}

interface SartFollowupRecord {
  id: string;
  followup_date: string;
  attendance_improved: 'yes' | 'partial' | 'no';
  action_items_completed: Record<string, boolean>;
  outcome: 'closed' | 'continue_monitoring' | 'escalate_sarb';
  notes: string;
  createdAt: string;
}

interface SartActionItem {
  id: string;
  description: string;
  assigned_role: string;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  completed_by_name: string | null;
}
```

Add a new `WorkflowStep` type for the collapsible step UI:
```ts
type WorkflowStepStatus = 'locked' | 'active' | 'complete';

interface WorkflowStep {
  key: string;
  tier: 1 | 2 | 3;
  label: string;
  status: WorkflowStepStatus;
  completedAt: string | null;
  completedBy: string | null;
  blockingReasons: string[];
}
```

---

## Phase 3: Service Layer Updates

### 3a. Update `getCaseWorkspace.ts`

- Add `root_cause, sart_data` to the compliance_cases SELECT
- Fetch `intervention_log` entries with `intervention_type IN ('sart_meeting', 'sart_followup')`
- Fetch `actions` with `action_type = 'sart_action'` (for the SART action plan)
- Fetch `districts.toolkit_url, districts.toolkit_name` via the existing district fetch
- Parse all into the new response fields
- Update `buildTierChecklist()` to include new items:
  - Tier 1: add `root_cause_documented`, `sart_referral_logged`
  - Tier 2: add `sart_meeting_held`, `sart_action_plan_created`, `sart_followup_complete`

### 3b. New service: `console/src/services/compliance/saveRootCauseAssessment.ts`

- Writes to `compliance_cases.root_cause` JSONB
- Validates: at least 1 category checked + narrative >= 50 chars
- Sets `savedAt` timestamp and `savedBy` from current user

### 3c. New service: `console/src/services/compliance/saveSartReferral.ts`

- Writes to `compliance_cases.sart_data` JSONB
- Auto-populates `referred_by` from current user profile

### 3d. New service: `console/src/services/compliance/saveSartMeeting.ts`

- Inserts into `intervention_log` with `intervention_type = 'sart_meeting'`
- Stores structured data in the `description` field as JSON string (or use a new `metadata` JSONB — but `description` is text, so we'll serialize)
- Actually: the `intervention_log.outcome` field exists. We'll use `description` for notes and `outcome` for the meeting outcome. Structured attendee/agenda data goes into a JSONB column we'll add to intervention_log OR we encode in description.

**Decision:** Add `metadata JSONB` column to `intervention_log` in the migration. This is cleaner than stuffing JSON into a text field:
```sql
ALTER TABLE intervention_log ADD COLUMN IF NOT EXISTS metadata JSONB;
```

### 3e. New service: `console/src/services/compliance/saveSartActionPlan.ts`

- Inserts up to 5 actions into the `actions` table with `action_type = 'sart_action'`
- Uses existing attribution system (`completed_by`, `completed_by_name`, `completed_by_role`)
- Links to the compliance case via `compliance_case_id`

### 3f. New service: `console/src/services/compliance/saveSartFollowup.ts`

- Inserts into `intervention_log` with `intervention_type = 'sart_followup'`
- Validates followup_date is 25-35 days after SART meeting date
- If outcome = `'escalate_sarb'`, this unlocks SARB packet generation

### 3g. Update `completeAction.ts` tier gate

- Add Tier 2 gate: require `root_cause` saved (1+ category + narrative) AND `sart_data` saved
- Update Tier 3 gate: add 7-item prereq check (truancy letter + root cause + SART referral + SART meeting + conference + action plan + followup=escalate_sarb)

---

## Phase 4: Update `DistrictRecord` type

**File:** `console/src/types/organization.ts`

Add `toolkit_url` and `toolkit_name` to `DistrictRecord`.

**File:** `console/src/services/schools/getDistrict.ts`

Add `toolkit_url, toolkit_name` to the SELECT query.

---

## Phase 5: New UI Components

### 5a. `WorkflowStepsCard.tsx` (replaces TierChecklistCard in workspace layout)

A vertical sequence of 8 collapsible steps. Each step shows:
- **Complete:** green checkmark + completion date + who completed it. Content read-only (except district_admin can edit).
- **Active (next required):** expanded by default, shows the input form.
- **Locked:** lock icon + list of blocking prerequisites.

Steps in order:
1. Truancy Letter Sent (Tier 1) — existing, shows status from tier checklist
2. Root Cause Assessment (Tier 1, NEW)
3. SART Referral (Tier 1, NEW)
4. SART Meeting (Tier 2, NEW)
5. Parent Conference (Tier 2) — existing, shows status from tier checklist
6. SART Action Plan (Tier 2, NEW)
7. 30-Day Follow-up (Tier 2, NEW)
8. SARB Packet (Tier 3) — existing, enhanced with 7-gate prereq check

### 5b. `RootCauseStep.tsx` (embedded inside WorkflowStepsCard step 2)

- Checkbox grid: `transportation`, `housing_instability`, `health_medical`, `family_circumstances`, `school_climate`, `academic_struggles`, `work_obligations`, `unknown`
- Each checkbox reveals an optional notes textarea when checked
- Required narrative field (min 50 chars) with character counter
- Save button → `saveRootCauseAssessment()`
- Shows as complete once saved with 1+ category + narrative

### 5c. `SartReferralStep.tsx` (step 3)

- `referral_trigger` dropdown: absences_threshold / teacher_concern / parent_request / reentry
- `referral_date` date picker
- `prior_informal_interventions` textarea
- `referred_by` auto-populated (read-only badge showing current user)
- Save button → `saveSartReferral()`

### 5d. `SartMeetingStep.tsx` (step 4)

- `meeting_date` date picker
- `attendees` multi-select checkboxes: Attendance Clerk / Counselor / Principal / Parent / Student / Other
- `family_present` yes/no toggle
- `agenda_checklist`: 5 checkboxes (review_attendance / review_prior_interventions / family_perspective / identify_barriers / agree_action_plan)
- `outcome` dropdown: action_plan_agreed / escalate_sarb / close_case
- `notes` textarea
- County toolkit link: if `districtToolkit.url` exists → "Reference toolkit: [name ↗]", else "Consult your county SART resources"
- Save button → `saveSartMeeting()`

### 5e. `SartActionPlanStep.tsx` (step 6)

- Dynamic list (1-5 items), + Add Item button
- Each item: description (text input), assigned_role (dropdown), due_date (date picker), completed (checkbox)
- Save creates action records in the `actions` table
- Once saved, shows completion status from actions table with attribution

### 5f. `SartFollowupStep.tsx` (step 7)

- `followup_date` date picker with validation (25-35 days after SART meeting)
- `attendance_improved` radio: yes / partial / no
- `action_items_completed` checklist (populated from SART action plan)
- `outcome` dropdown: closed / continue_monitoring / escalate_sarb
- `notes` textarea
- Save button → `saveSartFollowup()`
- If outcome = escalate_sarb → shows confirmation that SARB packet is now unlocked

---

## Phase 6: Update `SarbPacketCard.tsx`

Replace the existing 5-item readiness checklist with the full 7-item gate:

1. ☐ Truancy letter sent (Tier 1)
2. ☐ Root cause documented (min 1 category + narrative)
3. ☐ SART referral logged
4. ☐ SART meeting held
5. ☐ Parent conference complete (Tier 2)
6. ☐ SART action plan created (min 1 item)
7. ☐ 30-day follow-up outcome = escalate_sarb

Generate button only active when all 7 are checked. Blocked items show what's missing.

---

## Phase 7: Update `CaseWorkspacePage.tsx`

Replace `TierChecklistCard` with the new `WorkflowStepsCard` in the left column. Move `RootCauseCard` from right column into WorkflowStepsCard step 2 (it becomes embedded). The existing `RootCauseCard` is retired in favor of the new `RootCauseStep` which has the simpler checkbox-grid format requested.

New layout:
```
Left column:
  - WorkflowStepsCard (8 collapsible steps — replaces TierChecklistCard)
  - OpenActionsCard (existing — unchanged)
  - DocumentsCard (existing — unchanged)
  - SarbPacketCard (existing — updated prereq checklist)

Right column:
  - StudentSummaryCard (existing — unchanged)
  - TimelineCard (existing — unchanged, will show SART events from intervention_log)
  - CaseResolutionCard (existing — unchanged)
```

---

## Phase 8: Backend Gate Updates

### `completeAction.ts`

Update `checkTierGate()`:
- **Tier 2 actions** now require: Tier 1 notification_sent + root_cause saved + sart_data saved
- **Tier 3 actions** now require all 7 prerequisites (full SARB gate)

### `OpenActionsCard.tsx`

Update `getBlockingReasons()` to match the expanded gates — show new blocking reasons for root cause and SART steps.

---

## Phase 9: TypeScript Verification

Run `npx tsc --noEmit` from console directory. Fix any errors until clean.

---

## File Inventory

### New files (10):
1. `supabase/migrations/20260312002_sart_workflow.sql`
2. `console/src/services/compliance/saveRootCauseAssessment.ts`
3. `console/src/services/compliance/saveSartReferral.ts`
4. `console/src/services/compliance/saveSartMeeting.ts`
5. `console/src/services/compliance/saveSartActionPlan.ts`
6. `console/src/services/compliance/saveSartFollowup.ts`
7. `console/src/components/compliance/workspace/WorkflowStepsCard.tsx`
8. `console/src/components/compliance/workspace/steps/RootCauseStep.tsx`
9. `console/src/components/compliance/workspace/steps/SartReferralStep.tsx`
10. `console/src/components/compliance/workspace/steps/SartMeetingStep.tsx`
11. `console/src/components/compliance/workspace/steps/SartActionPlanStep.tsx`
12. `console/src/components/compliance/workspace/steps/SartFollowupStep.tsx`

### Modified files (8):
1. `console/src/types/caseWorkspace.ts` — new types + extended CaseWorkspaceResponse
2. `console/src/types/organization.ts` — add toolkit fields to DistrictRecord
3. `console/src/services/schools/getDistrict.ts` — add toolkit fields to SELECT
4. `console/src/services/compliance/getCaseWorkspace.ts` — fetch & parse new data
5. `console/src/services/actions/completeAction.ts` — expanded tier gates
6. `console/src/components/compliance/workspace/OpenActionsCard.tsx` — expanded blocking reasons
7. `console/src/components/compliance/workspace/SarbPacketCard.tsx` — 7-item prereq gate
8. `console/src/pages/compliance/CaseWorkspacePage.tsx` — new layout with WorkflowStepsCard

### Retired (soft — no longer referenced from CaseWorkspacePage):
- `console/src/components/compliance/workspace/TierChecklistCard.tsx` — replaced by WorkflowStepsCard
- `console/src/components/compliance/workspace/RootCauseCard.tsx` — replaced by RootCauseStep

---

## Execution Order

1. Migration (Phase 1) — no dependencies
2. Types (Phase 2) — no dependencies
3. Organization types + district service (Phase 4) — quick
4. Services (Phase 3) — depends on types
5. Step components (Phase 5b-5f) — depends on services + types
6. WorkflowStepsCard (Phase 5a) — depends on step components
7. SarbPacketCard update (Phase 6) — depends on types
8. CaseWorkspacePage update (Phase 7) — depends on WorkflowStepsCard
9. Gate updates (Phase 8) — depends on types
10. TypeScript verification (Phase 9) — last
