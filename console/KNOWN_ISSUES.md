# Edvera Console — Known Issues

## 1. Large main bundle (1,540 KB)

**Status:** Deferred to Layer 2
**Description:** The production build produces a single main JS chunk of ~1.5 MB (446 KB gzipped). All page components are bundled together with no route-level code splitting.
**Impact:** Slower initial page load on poor connections. No functional impact.
**Fix:** Add `React.lazy` + dynamic `import()` for route-level code splitting in App.tsx.

## 2. InsightsPanel API credit error

**Status:** Deferred — known pre-existing issue
**Description:** The InsightsPanel component calls `supabase.functions.invoke("generate-insights")` which may fail with an API credit or quota error when the Supabase edge function's upstream AI provider is unconfigured or exhausted.
**Impact:** The insights panel shows an error state. No impact on other functionality.
**Fix:** Add proper error handling and a user-facing message explaining the feature requires configuration.

## 3. No route-level code splitting

**Status:** Deferred to Layer 2
**Description:** All page components are eagerly imported in App.tsx. This contributes to the large bundle size noted in issue #1.
**Impact:** Performance only. No functional impact.
**Fix:** Convert static imports to `React.lazy()` with `<Suspense>` boundaries.

## 4. Direct Supabase access in pages and components

**Status:** ✅ Resolved (L4-P7)
**Description:** All 10 files in `pages/` and `components/` that previously imported `supabase` directly have been migrated to use service functions. Zero violations remain.

### Services created (L4-P7)

| Service file | Replaces |
|-------------|----------|
| `services/auth.ts` | `signIn`, `signOut`, `getCurrentUserId` — wraps `supabase.auth.*` |
| `services/compliance/getCaseList.ts` | Inline query in `CompliancePage.tsx` |
| `services/compliance/updateCase.ts` | 7 mutations: `resolveCase`, `approveSarbPacket`, `requestSarbChanges`, `submitSarbForApproval`, `markSarbSubmitted`, `updateRootCauseData`, `updateCaseFields` |
| `services/profiles/getProfile.ts` | Inline profile query in `SettingsPage.tsx` |
| `services/profiles/getStaffMembership.ts` | Inline staff query in `SettingsPage.tsx` |
| `services/profiles/updateProfile.ts` | Inline profile update in `SettingsPage.tsx` |
| `services/profiles/getCurrentUserDisplayName.ts` | Combined auth+profile lookup for `ConferenceSummaryModal`, `TierLetterGenerationModal` |
| `services/students/getStudentContact.ts` | Inline contacts query in `TierLetterGenerationModal.tsx` |
| `services/actions/getConferenceAction.ts` | Inline actions query in `ConferenceSummaryModal.tsx` |
| `services/schools/getDistrictName.ts` | Hardcoded "Pacific Unified School District" in 3 files |

### Previously resolved (L4-P2 through L4-P6)

| File | Resolution |
|------|------------|
| `pages/StudentsPage.tsx` | Migrated to `getStudentList` service (L4-P2) |
| `hooks/useStudentDetail.ts` | Migrated to `getStudentDetail` service (L4-P2) |
| `hooks/useActionCenter.ts` | Migrated to `getActionList` + `getActionStats` services (L4-P3) |
| `services/compliance/completeAction.ts` | Moved to `services/actions/completeAction.ts` (L4-P3) |
| `services/compliance/getCaseWorkspace.ts` | Org queries migrated to `getSchool`/`getDistrict`/`getCountyOffice` services (L4-P4) |
| `services/reports/getReportData.ts` | Decomposed into 5 focused services; types moved to `types/reports.ts` (L4-P6) |
| `lib/documents/sarb-packet.ts` | Data fetching moved to `services/documents/generateSarbPacket.ts` (L4-P5) |

## 5. Files over 400 lines

**Status:** Documented — justified exceptions
**Description:** 10 source files exceed the 400-line soft limit. Each is justified below.

| # | File | Lines | Justification |
|---|------|------:|---------------|
| 1 | `lib/engines/csv-processor.ts` | 941 | Complex CSV parsing engine with column mapping, validation rules, and multi-format support. Splitting would fragment tightly-coupled parsing logic. |
| 2 | `lib/documents/sarb-packet.ts` | 706 | PDF layout builder with coordinate-based positioning for a multi-page legal form. Layout constants, helper functions, and page assembly are inherently coupled. |
| 3 | `services/compliance/getCaseWorkspace.ts` | 615 | Composite query that assembles a full case workspace from 8+ tables. The joins, transformations, and type mapping form a single logical unit. |
| 4 | `components/reports/districtReportPdf.ts` | 445 | PDF builder for a multi-section district report. Page layout, chart sections, and table rendering are tightly coupled. |
| 5 | `pages/SecurityPage.tsx` | 443 | Static content page (security practices). All content is declarative JSX — no complex logic to extract. |
| 6 | `hooks/useImportFlow.ts` | 431 | Multi-step import wizard state machine. Steps, validation, and transitions are a single logical flow. |
| 7 | `hooks/useSarbPacket.ts` | 425 | SARB packet assembly hook with document gathering, validation, and PDF generation. Tightly-coupled workflow. |
| 8 | `pages/LegalReferencePage.tsx` | 409 | Static legal reference content (Education Code sections). Declarative JSX data. |
| 9 | `components/compliance/workspace/RootCauseCard.tsx` | 406 | SART assessment form with 6 domains, 23 questions, tri-state toggles, and auto-save. Inline form avoids unnecessary abstraction. |
| 10 | `components/student-detail/StudentHistoryTimeline.tsx` | 405 | Timeline component with multiple event types, date grouping, and detail rendering. Cohesive visual unit. |

**Note:** All files under 400 lines after the L4 cleanup. No file has grown — several have shrunk through service extraction.

## 6. Hooks still import supabase directly (2 files)

**Status:** Documented — acceptable pattern
**Description:** Two hooks (`useDashboard.ts`, `useImportFlow.ts`) still import `supabase` directly. The L4-P7 scope was pages and components only. Hooks are one abstraction layer above components and are acceptable supabase consumers until further service extraction.
**Impact:** No functional impact. Minor architectural inconsistency.
**Fix:** Future work — extract dashboard and import queries into dedicated services.
