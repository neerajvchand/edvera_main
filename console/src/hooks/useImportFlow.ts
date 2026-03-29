import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  autoMapColumns,
  normalizeRow,
  validateRow,
  fuzzyMatchSchool,
  mapToCanonicalType,
  getAttendanceFlags,
  detectAbsenceOnlyExport,
  buildNormalizationSummary,
  type ColumnMapping,
  type NormalizedRow,
  type ValidationResult,
  type NormalizationEntry,
} from "@/lib/engines/csv-processor";
import { useEngineRunner } from "@/hooks/useEngineRunner";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export type WizardStep = "upload" | "map" | "validate" | "import";

export const STEPS: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map Columns" },
  { key: "validate", label: "Validate" },
  { key: "import", label: "Import" },
];

export interface ParsedFile {
  name: string;
  size: number;
  headers: string[];
  rows: Record<string, string>[];
}

export interface ValidatedRow {
  row: NormalizedRow;
  result: ValidationResult;
}

export interface ImportSummary {
  studentsCreated: number;
  studentsUpdated: number;
  schoolsCreated: number;
  recordsImported: number;
  duplicatesSkipped: number;
  errorsSkipped: number;
  newChronicDetected: number;
  newComplianceCases: number;
  newActionsGenerated: number;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useImportFlow() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(
    new Set()
  );

  // Step 1 state
  const [parsed, setParsed] = useState<ParsedFile | null>(null);

  // Step 2 state
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // Step 3 state
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [isAbsenceOnly, setIsAbsenceOnly] = useState(false);
  const [normSummary, setNormSummary] = useState<NormalizationEntry[]>([]);

  // Step 4 state
  const [importPhase, setImportPhase] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Engine runner
  const { progress: engineProgress, runAllEngines } = useEngineRunner();

  /* ---- Step 1 → 2 ---- */
  const handleFileReady = useCallback((file: ParsedFile) => {
    setParsed(file);
    const autoMapping = autoMapColumns(file.headers);
    setMapping(autoMapping);
    setCompletedSteps((prev) => new Set([...prev, "upload"]));
    setStep("map");
  }, []);

  /* ---- Step 2 → 3 ---- */
  const handleMappingContinue = useCallback(() => {
    if (!parsed) return;
    const seenKeys = new Set<string>();
    const validated: ValidatedRow[] = parsed.rows.map((raw, i) => {
      const row = normalizeRow(raw, mapping, i);
      const result = validateRow(row, seenKeys);
      return { row, result };
    });
    setValidatedRows(validated);

    // Compute normalization summary and absence-only detection
    const allRows = validated.map((v) => v.row);
    setNormSummary(buildNormalizationSummary(allRows));
    setIsAbsenceOnly(detectAbsenceOnlyExport(allRows));

    setCompletedSteps((prev) => new Set([...prev, "map"]));
    setStep("validate");
  }, [parsed, mapping]);

  /* ---- Step 3 → 4: Run import ---- */
  const handleImport = useCallback(async () => {
    setCompletedSteps((prev) => new Set([...prev, "validate"]));
    setStep("import");
    setImportPhase("Preparing import...");
    setImportProgress(0);

    const importable = validatedRows.filter((v) => v.result.valid);
    const errorsSkipped = validatedRows.filter(
      (v) => !v.result.valid
    ).length;

    try {
      // ---- Fetch existing schools ----
      const { data: schoolsData } = await supabase
        .from("schools")
        .select("id, name");
      let existingSchools = schoolsData ?? [];

      // ---- Fetch existing district ----
      const { data: districts } = await supabase
        .from("districts")
        .select("id")
        .limit(1);
      const districtId = districts?.[0]?.id;
      if (!districtId) throw new Error("No district found");

      // ============================
      // PHASE 0: Auto-create missing schools
      // ============================
      setImportPhase("Checking schools...");
      setImportProgress(2);

      // Collect unique school names from CSV
      const csvSchoolNames = new Set<string>();
      for (const v of importable) {
        const name = v.row.school_name?.trim();
        if (name) csvSchoolNames.add(name);
      }

      let schoolsCreated = 0;
      for (const csvName of csvSchoolNames) {
        const match = fuzzyMatchSchool(csvName, existingSchools);
        if (!match) {
          // School doesn't exist — auto-create it
          const { data: newSchool, error: schoolErr } = await supabase
            .from("schools")
            .insert({ name: csvName, district_id: districtId })
            .select("id, name")
            .single();

          if (!schoolErr && newSchool) {
            existingSchools = [...existingSchools, newSchool];
            schoolsCreated++;
            console.log(`Auto-created school: "${csvName}" (${newSchool.id})`);
          } else if (schoolErr) {
            console.warn(`Failed to create school "${csvName}":`, schoolErr.message);
          }
        }
      }

      // ============================
      // PHASE 1: Create/update students
      // ============================
      setImportPhase("Creating/updating student records...");

      // Deduplicate students from CSV rows
      const studentMap = new Map<
        string,
        {
          sis_id: string;
          first_name: string;
          last_name: string;
          grade_level: string;
          school_name: string;
          ssid: string;
          date_of_birth: string;
          gender: string;
        }
      >();
      for (const v of importable) {
        const key = v.row.student_sis_id;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            sis_id: v.row.student_sis_id,
            first_name: v.row.first_name,
            last_name: v.row.last_name,
            grade_level: v.row.grade_level,
            school_name: v.row.school_name,
            ssid: v.row.ssid,
            date_of_birth: v.row.date_of_birth,
            gender: v.row.gender,
          });
        }
      }

      // ============================
      // PHASE 0.5: Bootstrap staff membership for importer
      // ============================
      // The importer needs staff_memberships BEFORE any data writes,
      // otherwise RLS will block INSERT on students, attendance, etc.
      setImportPhase("Ensuring staff access...");
      setImportProgress(5);

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (currentUser) {
        // Pre-resolve all unique school IDs referenced by CSV rows
        const importSchoolIds = new Set<string>();
        for (const [, info] of studentMap) {
          const match = fuzzyMatchSchool(info.school_name, existingSchools);
          const schoolId = match?.id ?? existingSchools[0]?.id;
          if (schoolId) importSchoolIds.add(schoolId);
        }

        for (const schoolId of importSchoolIds) {
          const { error: smError } = await supabase
            .from("staff_memberships")
            .upsert(
              {
                user_id: currentUser.id,
                school_id: schoolId,
                role: "district_admin",
                is_active: true,
              },
              { onConflict: "user_id,school_id" }
            );
          if (smError) {
            console.warn("staff_membership upsert failed:", smError.message);
          }
        }
      }

      // Fetch existing students by sis_student_id
      const sisIds = [...studentMap.keys()];
      const existingStudentsMap = new Map<
        string,
        { id: string; school_id: string }
      >();

      // Batch fetch in chunks of 100
      for (let i = 0; i < sisIds.length; i += 100) {
        const batch = sisIds.slice(i, i + 100);
        const { data: existing } = await supabase
          .from("students")
          .select("id, sis_student_id, school_id")
          .in("sis_student_id", batch);
        for (const s of existing ?? []) {
          existingStudentsMap.set(s.sis_student_id, {
            id: s.id,
            school_id: s.school_id,
          });
        }
      }

      let studentsCreated = 0;
      let studentsUpdated = 0;

      // Resolve school IDs + upsert students
      const studentIdBySis = new Map<string, string>(); // sis_id → uuid
      const studentSchoolBySis = new Map<string, string>(); // sis_id → school uuid
      const totalStudents = studentMap.size;
      let processedStudents = 0;

      const STUDENT_BATCH = 50;
      const studentEntries = [...studentMap.entries()];

      for (let i = 0; i < studentEntries.length; i += STUDENT_BATCH) {
        const batch = studentEntries.slice(i, i + STUDENT_BATCH);
        const inserts: Record<string, unknown>[] = [];
        const updates: { id: string; data: Record<string, unknown> }[] = [];

        for (const [sisId, info] of batch) {
          const schoolMatch = fuzzyMatchSchool(
            info.school_name,
            existingSchools
          );
          const schoolId = schoolMatch?.id ?? existingSchools[0]?.id;

          if (existingStudentsMap.has(sisId)) {
            const existing = existingStudentsMap.get(sisId)!;
            studentIdBySis.set(sisId, existing.id);
            studentSchoolBySis.set(sisId, existing.school_id);
            const updateData: Record<string, unknown> = {
              first_name: info.first_name,
              last_name: info.last_name,
              grade_level: info.grade_level || undefined,
            };
            if (info.ssid) updateData.ssid = info.ssid;
            if (info.date_of_birth) updateData.birth_date = info.date_of_birth;
            if (info.gender) updateData.gender = info.gender;
            updates.push({ id: existing.id, data: updateData });
          } else {
            const insertRow: Record<string, unknown> = {
              district_id: districtId,
              school_id: schoolId,
              sis_student_id: sisId,
              first_name: info.first_name,
              last_name: info.last_name,
              grade_level: info.grade_level || "K",
              is_active: true,
            };
            if (info.ssid) insertRow.ssid = info.ssid;
            if (info.date_of_birth) insertRow.birth_date = info.date_of_birth;
            if (info.gender) insertRow.gender = info.gender;
            inserts.push(insertRow);
          }
        }

        // Batch insert new students
        if (inserts.length > 0) {
          const { data: inserted, error } = await supabase
            .from("students")
            .upsert(inserts, { onConflict: "district_id,sis_student_id" })
            .select("id, sis_student_id, school_id");
          if (!error && inserted) {
            for (const s of inserted) {
              studentIdBySis.set(s.sis_student_id, s.id);
              studentSchoolBySis.set(s.sis_student_id, s.school_id);
            }
            studentsCreated += inserted.length;
          }
        }

        // Individual updates
        for (const u of updates) {
          await supabase.from("students").update(u.data).eq("id", u.id);
          studentsUpdated++;
        }

        processedStudents += batch.length;
        setImportProgress(
          Math.round((processedStudents / totalStudents) * 40)
        );
      }

      // ---- Create enrollments for new students ----
      const now = new Date();
      const academicYear =
        now.getMonth() >= 6
          ? `${now.getFullYear()}-${now.getFullYear() + 1}`
          : `${now.getFullYear() - 1}-${now.getFullYear()}`;

      // Find earliest attendance date in CSV
      const allDates = importable
        .map((v) => v.row.attendance_date)
        .filter(Boolean)
        .sort();
      const earliestDate = allDates[0] ?? now.toISOString().slice(0, 10);

      const enrollmentInserts: Record<string, unknown>[] = [];
      for (const [sisId] of studentMap.entries()) {
        const studentId = studentIdBySis.get(sisId);
        const schoolId = studentSchoolBySis.get(sisId);
        if (studentId && schoolId) {
          enrollmentInserts.push({
            student_id: studentId,
            school_id: schoolId,
            academic_year: academicYear,
            grade_level: studentMap.get(sisId)?.grade_level || "K",
            enter_date: earliestDate,
          });
        }
      }

      if (enrollmentInserts.length > 0) {
        for (let i = 0; i < enrollmentInserts.length; i += 100) {
          const batch = enrollmentInserts.slice(i, i + 100);
          await supabase
            .from("enrollments")
            .upsert(batch, {
              onConflict: "student_id,school_id,academic_year,enter_date",
            });
        }
      }

      // ============================
      // PHASE 2: Import attendance records
      // ============================
      setImportPhase("Importing attendance records...");
      setImportProgress(40);

      let recordsImported = 0;
      let duplicatesSkipped = 0;
      const ATTENDANCE_BATCH = 100;
      const totalRecords = importable.length;

      for (let i = 0; i < importable.length; i += ATTENDANCE_BATCH) {
        const batch = importable.slice(i, i + ATTENDANCE_BATCH);
        const rows: Record<string, unknown>[] = [];

        for (const v of batch) {
          const studentId = studentIdBySis.get(v.row.student_sis_id);
          const schoolId = studentSchoolBySis.get(v.row.student_sis_id);
          if (!studentId || !schoolId) continue;

          const absenceType =
            v.row.absence_type ||
            (v.row.status === "absent" ? "unexcused" : "");
          const canonicalType = mapToCanonicalType(v.row.status, absenceType);
          const flags = getAttendanceFlags(canonicalType);

          rows.push({
            student_id: studentId,
            school_id: schoolId,
            calendar_date: v.row.attendance_date,
            sis_absence_code: v.row.absence_code || null,
            canonical_type: canonicalType,
            counts_for_ada: flags.counts_for_ada,
            counts_as_truancy: flags.counts_as_truancy,
            has_period_detail: false,
            last_synced_at: new Date().toISOString(),
          });
        }

        if (rows.length > 0) {
          const { error } = await supabase
            .from("attendance_daily")
            .upsert(rows, { onConflict: "student_id,calendar_date" });

          if (!error) {
            recordsImported += rows.length;
          }
        }

        setImportProgress(
          40 + Math.round(((i + batch.length) / totalRecords) * 35)
        );
      }

      // ============================
      // PHASE 2.5: Derive school calendar from attendance dates
      // ============================
      // The snapshot engine needs school_calendars to know which dates
      // are instructional days. We derive this from the attendance records
      // just imported — any date with attendance data is a school day.
      // Uses ON CONFLICT DO NOTHING so manual corrections aren't overwritten.
      setImportPhase("Deriving school calendar...");
      setImportProgress(75);

      const calendarEntries = new Map<
        string,
        { school_id: string; calendar_date: string }
      >();
      for (const v of importable) {
        const schoolId = studentSchoolBySis.get(v.row.student_sis_id);
        if (!schoolId || !v.row.attendance_date) continue;
        const key = `${schoolId}::${v.row.attendance_date}`;
        if (!calendarEntries.has(key)) {
          calendarEntries.set(key, {
            school_id: schoolId,
            calendar_date: v.row.attendance_date,
          });
        }
      }

      const calendarRows = [...calendarEntries.values()].map((entry) => ({
        school_id: entry.school_id,
        calendar_date: entry.calendar_date,
        academic_year: academicYear,
        is_school_day: true,
      }));

      const CALENDAR_BATCH = 100;
      for (let i = 0; i < calendarRows.length; i += CALENDAR_BATCH) {
        const batch = calendarRows.slice(i, i + CALENDAR_BATCH);
        await supabase
          .from("school_calendars")
          .upsert(batch, {
            onConflict: "school_id,calendar_date",
            ignoreDuplicates: true,
          });
      }

      // ============================
      // PHASE 3: Run engines
      // ============================
      setImportPhase("Running intelligence engines...");
      setImportProgress(80);

      const engineResult = await runAllEngines();

      setImportProgress(100);

      // ---- Build final summary ----
      const finalSummary: ImportSummary = {
        studentsCreated,
        studentsUpdated,
        schoolsCreated,
        recordsImported,
        duplicatesSkipped,
        errorsSkipped,
        newChronicDetected: engineResult?.snapshots?.chronic_count ?? 0,
        newComplianceCases: engineResult?.compliance?.new_cases ?? 0,
        newActionsGenerated: engineResult?.actions?.new_actions ?? 0,
      };

      setCompletedSteps((prev) => new Set([...prev, "import"]));
      setSummary(finalSummary);
    } catch (err) {
      setImportPhase(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }, [validatedRows, runAllEngines]);

  /* ---- Navigation helpers ---- */
  const goBackToUpload = useCallback(() => {
    setParsed(null);
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete("upload");
      return next;
    });
    setStep("upload");
  }, []);

  const goBackToMap = useCallback(() => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete("map");
      return next;
    });
    setStep("map");
  }, []);

  return {
    step,
    completedSteps,
    parsed,
    mapping,
    setMapping,
    validatedRows,
    isAbsenceOnly,
    normSummary,
    importPhase,
    importProgress,
    summary,
    engineProgress,
    handleFileReady,
    handleMappingContinue,
    handleImport,
    goBackToUpload,
    goBackToMap,
  };
}
