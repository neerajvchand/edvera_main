# Edvera Console — Coding Standards

## 1. Service Layer Rule

**All Supabase access must go through the service layer or a dedicated hook.**

| Layer | May import `supabase`? | Examples |
|---|---|---|
| `src/services/**` | ✅ Yes | `getCaseWorkspace.ts`, `getStudentList.ts` |
| `src/hooks/**` | ✅ Yes | `useDashboard.ts`, `useImportFlow.ts` |
| `src/lib/**` | ✅ Yes (utilities only) | `supabase.ts` (client) |
| `src/pages/**` | ❌ No | Pages call hooks or services, never Supabase directly |
| `src/components/**` | ❌ No | Components receive data via props or hooks |

### Why?

- **Testability** — Services can be unit-tested without rendering React.
- **Single source of truth** — Every table query lives in one place.
- **Separation of concerns** — Components handle UI, services handle data.

### Service function pattern

```ts
// src/services/students/getStudentList.ts
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";

export interface StudentRow { /* ... */ }

export async function getStudentList(): Promise<StudentRow[]> {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name, school_id, is_active")
      .eq("is_active", true)
      .order("full_name");

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    throw handleServiceError("load student list", err);
  }
}
```

### Hook consumption pattern

```ts
// src/hooks/useStudents.ts
import { getStudentList, type StudentRow } from "@/services/students/getStudentList";

export function useStudents() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentList()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { students, loading, error };
}
```

### Error handling

All service functions use `ServiceError` from `src/services/serviceError.ts`:

```ts
import { handleServiceError } from "@/services/serviceError";

try {
  // ... supabase calls
} catch (err) {
  throw handleServiceError("describe the action", err);
}
```

Hooks catch `ServiceError` and surface `error.message` to the UI. Components never see raw Supabase errors.

For non-critical fetches in components (e.g., pre-populating form fields), use `.catch(() => null)`:

```ts
const displayName = await getCurrentUserDisplayName().catch(() => null);
if (displayName) setPreparedBy(displayName);
```

## 2. Type Canonicalization

Shared types live in `src/types/`. Service files define their own return types inline (co-located). Page/component-level types that are shared across multiple consumers go in `src/types/`.

| Type file | Contents |
|-----------|----------|
| `types/caseWorkspace.ts` | `CaseWorkspaceResponse` and related types |
| `types/reports.ts` | `ReportData`, `SchoolAttendanceRow`, `ReportPeriod`, etc. |
| `types/organization.ts` | `SchoolRecord`, `DistrictRecord`, `CountyOfficeRecord` |

Service files may re-export types for backwards compatibility:

```ts
// services/reports/getReportData.ts
export type { SchoolAttendanceRow as SchoolRow } from "@/types/reports";
```

## 3. File size guideline

Target: every file under 400 lines. Documented exceptions in `KNOWN_ISSUES.md` for:
- Data engines / processors (e.g., `csv-processor.ts`)
- PDF/document builders (e.g., `sarb-packet.ts`, `districtReportPdf.ts`)
- Composite query services (e.g., `getCaseWorkspace.ts`)
- Static reference pages (e.g., `SecurityPage.tsx`, `LegalReferencePage.tsx`)

## 4. No hardcoded organization values

Never hardcode district names, school names, or staff names in components or services. Always fetch from the database:

```ts
// ✅ Correct — fetch from database
import { getDistrictName } from "@/services/schools/getDistrictName";
const name = await getDistrictName().catch(() => "District");

// ❌ Wrong — hardcoded
const name = "Pacific Unified School District";
```

Legitimate toolkit or framework names (e.g., "SMCOE SART Toolkit") are acceptable as they refer to external standards, not org-specific data.

## 5. Project structure

```
src/
├── pages/              # Route-level shells — compose hooks + components
├── components/         # Presentational — receive data via props or hooks
│   ├── compliance/     # Compliance workspace cards and modals
│   ├── reports/        # Report generation and PDF builder
│   └── student-detail/ # Student detail page components
├── hooks/              # React hooks — may call services, manage state
├── services/           # Pure async functions — all Supabase access here
│   ├── auth.ts         # Authentication (signIn, signOut, getCurrentUserId)
│   ├── serviceError.ts # ServiceError class and handleServiceError helper
│   ├── actions/        # Action CRUD (getActionList, completeAction, etc.)
│   ├── compliance/     # Case workspace, case list, case mutations
│   ├── documents/      # Document save and generation
│   ├── import/         # CSV import pipeline
│   ├── profiles/       # User profiles, staff memberships, display names
│   ├── reports/        # Report data aggregation (5 focused services + composite)
│   ├── schools/        # Schools, districts, county offices, district name
│   └── students/       # Student list, detail, contacts
├── types/              # Shared TypeScript types
├── lib/                # Utilities, Supabase client, PDF/doc builders
│   ├── supabase.ts     # Supabase client singleton
│   ├── utils.ts        # Shared utilities (cn, etc.)
│   ├── documents/      # Pure PDF generators (no DB access)
│   └── engines/        # CSV processor
└── App.tsx             # Route definitions
```

## 6. Service directory inventory

| Directory | Files | Purpose |
|-----------|-------|---------|
| `services/auth.ts` | 1 | `signIn`, `signOut`, `getCurrentUserId` |
| `services/actions/` | 3 | `getActionList`, `getActionStats`, `completeAction` |
| `services/compliance/` | 3 | `getCaseWorkspace`, `getCaseList`, `updateCase` |
| `services/documents/` | 2 | `saveDocument`, `generateSarbPacket` |
| `services/import/` | 1 | `importStudents` |
| `services/profiles/` | 4 | `getProfile`, `getStaffMembership`, `updateProfile`, `getCurrentUserDisplayName` |
| `services/reports/` | 6 | `getAttendanceOverview`, `getChronicAbsenteeReport`, `getComplianceStatusReport`, `getTruancyTrendReport`, `getSarbReferralReport`, `getReportData` (composite) |
| `services/schools/` | 4 | `getSchool`, `getDistrict`, `getDistrictName`, `getSchoolsByDistrict`, `getCountyOffice` |
| `services/students/` | 3 | `getStudentList`, `getStudentDetail`, `getStudentContact` |
