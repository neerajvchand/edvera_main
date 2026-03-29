# Edvera Console — Safe Data Wipe Script

Use this script when you need to reset student data for development or testing.

## Rules

- **NEVER** wipe `staff_memberships`, `schools`, `districts`, `profiles`, or `county_offices`.
  These are **configuration**, not student data. Wiping them breaks RLS for all users.
- The order below respects foreign-key constraints (children deleted before parents).
- Run this in the **Supabase SQL Editor** (which uses the `postgres` role and bypasses RLS).

## Safe wipe SQL

```sql
-- ============================================================
-- SAFE WIPE — student data only
-- ============================================================
-- ❌ NEVER wipe: staff_memberships, schools, districts,
--    profiles, county_offices
-- These are configuration — only wipe student-derived data.
-- ============================================================

-- 1. SARB / compliance artifacts (depend on compliance_cases)
DELETE FROM sarb_packets;
DELETE FROM compliance_documents;

-- 2. Intervention + actions (depend on compliance_cases + students)
DELETE FROM intervention_log;
DELETE FROM actions;

-- 3. Compliance cases (depend on students)
DELETE FROM compliance_cases;

-- 4. Engine outputs (depend on students)
DELETE FROM funding_projections;
DELETE FROM risk_signals;

-- 5. Attendance data (depend on students + schools)
DELETE FROM school_calendars;
DELETE FROM attendance_daily;
DELETE FROM attendance_snapshots;

-- 6. Enrollments (depend on students)
DELETE FROM enrollments;

-- 7. Students (leaf table — all dependents already deleted)
DELETE FROM students;
```

## After wiping

1. Re-import your CSV through the app (Settings → Import).
2. The import flow will:
   - Bootstrap `staff_memberships` for the importing user (Phase 0.5)
   - Create/update students, attendance records, and school calendars
   - Run all engines (snapshots → risk signals → compliance → actions → funding)
3. Navigate to the Compliance tab — cases should appear.

## Troubleshooting

If the Compliance page still shows 0 cases after import:

1. Check browser console for errors (`getCaseList error: ...`)
2. Verify `staff_memberships` exist:
   ```sql
   SELECT user_id, school_id, role, is_active
   FROM staff_memberships;
   ```
3. Verify compliance_cases were created:
   ```sql
   SELECT COUNT(*) FROM compliance_cases WHERE is_resolved = false;
   ```
4. If `staff_memberships` is empty, the import's Phase 0.5 failed.
   Check the browser console for `staff_membership upsert failed` warnings.
