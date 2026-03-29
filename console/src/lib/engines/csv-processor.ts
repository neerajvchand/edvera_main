/**
 * CSV Processor — Pure TypeScript
 *
 * Zero-dependency functions for normalizing, validating, and fuzzy-matching
 * CSV import data. Used both by the console (browser) and scripts (Node/Deno).
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ColumnMapping {
  [csvHeader: string]: string; // csvHeader → edvera field name or "skip"
}

export interface NormalizedRow {
  student_sis_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  school_name: string;
  attendance_date: string; // YYYY-MM-DD
  status: string; // present | absent | tardy | suspended
  absence_code: string;
  absence_type: string; // excused | unexcused | ""
  ssid: string; // California SSID (state student ID)
  date_of_birth: string; // YYYY-MM-DD
  gender: string; // M | F | X | ""
  _raw_row_index: number;
  _status_normalized_from?: string; // original raw value before normalization
  _status_warning?: string; // normalization warning if fuzzy-matched
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/** Result of the enhanced normalizeStatus function */
export interface StatusResult {
  status: "present" | "absent" | "tardy" | "suspended";
  absence_type: "excused" | "unexcused" | null;
  warning?: string; // if we inferred / fuzzy-matched
}

/** Hint for unmapped columns that contain status-like values */
export interface ColumnHint {
  csvHeader: string;
  suggestedField: string;
  reason: string;
}

/** Summary of how raw status values were normalized */
export interface NormalizationEntry {
  rawValues: string[];
  normalizedTo: string;
  count: number;
}

/* ------------------------------------------------------------------ */
/* Edvera field definitions                                            */
/* ------------------------------------------------------------------ */

export const EDVERA_FIELDS = [
  { key: "student_sis_id", label: "Student ID", required: true },
  { key: "full_name_last_first", label: "Full Name (Last, First)", required: false },
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: true },
  { key: "grade_level", label: "Grade Level", required: false },
  { key: "school_name", label: "School", required: false },
  { key: "attendance_date", label: "Attendance Date", required: true },
  { key: "status", label: "Status", required: true },
  { key: "absence_code", label: "Absence Code", required: false },
  { key: "absence_type", label: "Absence Type", required: false },
  { key: "excused_flag", label: "Excused Flag", required: false },
  { key: "ssid", label: "State Student ID (SSID)", required: false },
  { key: "date_of_birth", label: "Date of Birth", required: false },
  { key: "gender", label: "Gender", required: false },
] as const;

/** Base required fields — first_name + last_name can be satisfied by full_name_last_first */
export const REQUIRED_FIELDS = ["student_sis_id", "first_name", "last_name", "attendance_date", "status"];

/**
 * Check if all required fields are satisfied given a mapping.
 * full_name_last_first satisfies both first_name and last_name.
 */
export function areRequiredFieldsMapped(mapping: ColumnMapping): boolean {
  const mapped = new Set(Object.values(mapping).filter((v) => v !== "skip"));
  const hasFullName = mapped.has("full_name_last_first");
  for (const req of REQUIRED_FIELDS) {
    if (req === "first_name" || req === "last_name") {
      if (!mapped.has(req) && !hasFullName) return false;
    } else {
      if (!mapped.has(req)) return false;
    }
  }
  return true;
}

/**
 * Count how many required fields are satisfied given a mapping.
 */
export function countMappedRequired(mapping: ColumnMapping): number {
  const mapped = new Set(Object.values(mapping).filter((v) => v !== "skip"));
  const hasFullName = mapped.has("full_name_last_first");
  let count = 0;
  for (const req of REQUIRED_FIELDS) {
    if (req === "first_name" || req === "last_name") {
      if (mapped.has(req) || hasFullName) count++;
    } else {
      if (mapped.has(req)) count++;
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Fuzzy Column Matching                                               */
/* ------------------------------------------------------------------ */

const COLUMN_ALIASES: Record<string, string[]> = {
  student_sis_id: [
    "student_id", "studentid", "student id", "sis_id", "sisid", "sis id",
    "sis_student_id", "student_number", "studentnumber", "student number",
    "id", "att.sn", "att_sn", "pupil_id",
    // Skyward / generic
    "other id", "other_id", "otherid",
    "local id", "local_id", "localid",
    "student #", "stu #", "stu_num",
  ],
  full_name_last_first: [
    "student name", "student_name", "studentname",
    "name", "full name", "full_name", "fullname",
    "student", "pupil name", "pupil_name",
  ],
  first_name: [
    "first_name", "firstname", "first name", "fname", "first", "given_name",
    "stu.fn", "stu_fn",
  ],
  last_name: [
    "last_name", "lastname", "last name", "lname", "last", "surname",
    "family_name", "stu.ln", "stu_ln",
  ],
  grade_level: [
    "grade", "grade_level", "gradelevel", "grade level", "grd", "gr",
    "stu.gr", "stu_gr",
  ],
  school_name: [
    "school", "school_name", "schoolname", "school name", "site",
    "site_name", "campus", "sch.nm", "sch_nm", "building",
    // Skyward / generic
    "entity", "entity name", "entity_name",
    "school site", "school_site", "schoolsite",
    "site name", "building name", "building_name",
    "campus name", "campus_name",
    "location", "school location", "school_location",
    "organization", "org",
  ],
  attendance_date: [
    "date", "attendance_date", "attendancedate", "attendance date",
    "att_date", "calendar_date", "calendardate", "day",
    "att.dt", "att_dt", "absence_date", "absence date",
  ],
  status: [
    "status", "attendance_status", "attendancestatus", "attendance status",
    "att_status", "attstatus", "attendance_code", "present_absent",
    "att.ds", "att_ds", "att.al", "att_al", "att_code", "attcode",
    "description", "att_description",
    // Skyward
    "abs rsn description", "abs_rsn_description", "absrsndescription",
    "reason description", "reason_description",
  ],
  absence_code: [
    "absence_code", "absencecode", "absence code", "abs_code", "abscode",
    "reason_code", "reasoncode", "code", "att.rc", "att_rc", "absence_reason",
    "abs rsn", "abs_rsn",
  ],
  absence_type: [
    "absence_type", "absencetype", "absence type", "excuse_type",
    "excusetype", "excuse type", "type", "att.ty", "att_ty",
  ],
  excused_flag: [
    "excused", "excused_flag", "excusedflag", "is_excused", "isexcused",
    "att.ex", "att_ex", "exc", "excused_yn",
  ],
  ssid: [
    "ssid", "state_student_id", "state student id", "state_id", "stateid",
    "state id", "calpads_id", "calpads id", "calpads_student_id",
  ],
  date_of_birth: [
    "date_of_birth", "dateofbirth", "date of birth", "dob", "birth_date",
    "birthdate", "birth date", "birthday", "bday",
  ],
  gender: [
    "gender", "sex", "gender_code", "gendercode", "gender code",
    "stu.gn", "stu_gn",
  ],
};

/**
 * Attempts to match a CSV column header to an Edvera field name.
 * Returns the Edvera field key or null if no match.
 */
export function fuzzyMatchColumn(
  csvHeader: string,
  _edveraFields?: string[]
): string | null {
  const normalized = csvHeader.trim().toLowerCase().replace(/[_\-\s.]+/g, "");

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase().replace(/[_\-\s.]+/g, "");
      if (normalized === normalizedAlias) {
        return field;
      }
    }
  }

  return null;
}

/**
 * Auto-maps CSV headers to Edvera fields using fuzzy matching.
 * Returns a ColumnMapping where unmapped columns default to "skip".
 */
export function autoMapColumns(csvHeaders: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    const match = fuzzyMatchColumn(header);
    if (match && !usedFields.has(match)) {
      mapping[header] = match;
      usedFields.add(match);
    } else {
      mapping[header] = "skip";
    }
  }

  return mapping;
}

/* ------------------------------------------------------------------ */
/* Smart column hint detection (value-based)                           */
/* ------------------------------------------------------------------ */

const STATUS_SAMPLE_RE =
  /^(present|absent|tardy|p|a|t|0|1|late|prsnt|abs|in school|in attendance)$/i;
const ABSENCE_TYPE_SAMPLE_RE =
  /^(y|n|yes|no|true|false|excused|unexcused|e|u|1|0)$/i;
const ABSENCE_CODE_SAMPLE_RE =
  /^(au|ae|aex|tu|te|ill|unex|med|sus|oss|iss|ax|a1|a2|e1|e2|u1|u2)$/i;
const STATUS_DESC_RE =
  /absent|tardy|present|suspension|unexcused|excused|in school/i;

/**
 * Inspects sample values from unmapped columns and suggests field mappings.
 * Call after autoMapColumns to find hints for columns mapped as "skip".
 */
export function detectColumnHints(
  csvHeaders: string[],
  sampleRows: Record<string, string>[],
  mapping: ColumnMapping
): ColumnHint[] {
  const hints: ColumnHint[] = [];
  const mappedFields = new Set(Object.values(mapping).filter((v) => v !== "skip"));

  // Sample up to 10 rows
  const samples = sampleRows.slice(0, 10);

  for (const header of csvHeaders) {
    if (mapping[header] !== "skip") continue; // already mapped

    const values = samples
      .map((r) => (r[header] ?? "").trim())
      .filter(Boolean);
    if (values.length === 0) continue;

    // Check for combined name values (e.g. "Garcia, Maria" or "Maria Garcia")
    if (!mappedFields.has("full_name_last_first") && !mappedFields.has("first_name") && !mappedFields.has("last_name")) {
      const commaNames = values.filter((v) => /^[A-Za-z'-]+,\s*[A-Za-z'-]+/.test(v));
      if (commaNames.length >= values.length * 0.5) {
        hints.push({
          csvHeader: header,
          suggestedField: "full_name_last_first",
          reason: "This column contains combined names (Last, First). Map to Full Name?",
        });
        continue;
      }
    }

    // Check for status-like values
    if (!mappedFields.has("status")) {
      const statusMatches = values.filter(
        (v) => STATUS_SAMPLE_RE.test(v) || STATUS_DESC_RE.test(v)
      );
      if (statusMatches.length >= values.length * 0.5) {
        hints.push({
          csvHeader: header,
          suggestedField: "status",
          reason: "This column contains attendance status values. Map to Status?",
        });
        continue;
      }
    }

    // Check for absence type values
    if (!mappedFields.has("absence_type") && !mappedFields.has("excused_flag")) {
      const typeMatches = values.filter((v) => ABSENCE_TYPE_SAMPLE_RE.test(v));
      if (typeMatches.length >= values.length * 0.5) {
        hints.push({
          csvHeader: header,
          suggestedField: "absence_type",
          reason: "This column contains excused/unexcused values. Map to Absence Type?",
        });
        continue;
      }
    }

    // Check for absence code values
    if (!mappedFields.has("absence_code")) {
      const codeMatches = values.filter((v) => ABSENCE_CODE_SAMPLE_RE.test(v));
      if (codeMatches.length >= values.length * 0.3) {
        hints.push({
          csvHeader: header,
          suggestedField: "absence_code",
          reason: "This column contains known absence codes. Map to Absence Code?",
        });
      }
    }
  }

  return hints;
}

/* ------------------------------------------------------------------ */
/* Date normalization                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parses a date string in various formats and returns YYYY-MM-DD.
 * Supports: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, M/D/YY, MM-DD-YYYY
 * Returns empty string if unparseable.
 */
export function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashFull = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashFull) {
    const m = slashFull[1].padStart(2, "0");
    const d = slashFull[2].padStart(2, "0");
    return `${slashFull[3]}-${m}-${d}`;
  }

  // M/D/YY
  const slashShort = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (slashShort) {
    const m = slashShort[1].padStart(2, "0");
    const d = slashShort[2].padStart(2, "0");
    const yearNum = parseInt(slashShort[3], 10);
    const fullYear = yearNum >= 50 ? 1900 + yearNum : 2000 + yearNum;
    return `${fullYear}-${m}-${d}`;
  }

  return "";
}

/* ------------------------------------------------------------------ */
/* Enhanced Status Normalization                                       */
/* ------------------------------------------------------------------ */

/**
 * Normalizes a raw status string from any SIS export into a canonical
 * { status, absence_type } using layered detection logic.
 *
 * Handles: Aeries (ATT.AL 0/1, ATT.DS descriptions), PowerSchool,
 * Infinite Campus, generic CSV exports, and dozens of common variations.
 */
export function normalizeStatus(
  rawStatus: string,
  absenceCode?: string,
  absenceType?: string,
  excusedFlag?: string
): StatusResult {
  const s = (rawStatus ?? "").trim();
  const sLower = s.toLowerCase();
  const code = (absenceCode ?? "").trim().toUpperCase();
  let warning: string | undefined;

  // ----- Helper: determine excused/unexcused from layered inputs -----
  function resolveExcused(): "excused" | "unexcused" | null {
    // Priority 1: explicit absence_type parameter
    if (absenceType) {
      const at = absenceType.trim().toLowerCase();
      if (at === "excused" || at === "e" || at === "ex") return "excused";
      if (at === "unexcused" || at === "u" || at === "un" || at === "unex") return "unexcused";
      if (at === "y" || at === "yes") return "excused";
      if (at === "n" || at === "no") return "unexcused";
    }

    // Priority 2: explicit excused flag
    if (excusedFlag) {
      const ef = excusedFlag.trim().toLowerCase();
      if (ef === "y" || ef === "yes" || ef === "true" || ef === "1") return "excused";
      if (ef === "n" || ef === "no" || ef === "false" || ef === "0") return "unexcused";
    }

    // Priority 3: infer from raw status text
    if (/unexcused/i.test(s)) return "unexcused";
    if (/excused/i.test(s)) return "excused"; // "excused" but not "unexcused"
    if (/illness|medical|doctor|dental|funeral|religious|bereavement|hospitalized/i.test(s)) return "excused";
    if (/ill(?:ness)?|med(?:ical)?/i.test(sLower) && !sLower.includes("un")) return "excused";

    // Priority 3b: infer from absence code
    if (code) {
      if (/^(AE|AEX|TE|E\d?)$/i.test(code)) return "excused";
      if (/^(AU|AUX|TU|U\d?|UNEX)$/i.test(code)) return "unexcused";
      if (/^(ILL|MED|FUN|REL)$/i.test(code)) return "excused";
    }

    return null; // unknown
  }

  // ===================================================================
  // PRESENT detection
  // ===================================================================
  if (
    sLower === "present" || sLower === "p" || sLower === "prsnt" ||
    sLower === "in school" || sLower === "in" || sLower === "in attendance" ||
    sLower === "0" // Aeries ATT.AL: 0 = present
  ) {
    return { status: "present", absence_type: null };
  }
  if (sLower.includes("present") && !sLower.includes("absent")) {
    warning = `"${s}" interpreted as Present`;
    return { status: "present", absence_type: null, warning };
  }

  // ===================================================================
  // TARDY detection (before absent, since "Tardy" is more specific)
  // ===================================================================
  if (
    sLower === "tardy" || sLower === "t" || sLower === "tard" ||
    sLower === "tu" || sLower === "te" ||
    sLower === "late" || sLower === "l"
  ) {
    const exc = resolveExcused();
    const at = sLower === "te" ? "excused" : sLower === "tu" ? "unexcused" : exc;
    return { status: "tardy", absence_type: at };
  }
  if (/tardy|late/i.test(s)) {
    const exc = resolveExcused();
    const inferred = /unexcused/i.test(s) ? "unexcused" : /excused/i.test(s) ? "excused" : exc;
    if (sLower !== "tardy unexcused" && sLower !== "tardy excused" && sLower !== "late") {
      warning = `"${s}" interpreted as Tardy`;
    }
    return { status: "tardy", absence_type: inferred, warning };
  }

  // ===================================================================
  // SUSPENSION detection
  // ===================================================================
  if (
    sLower === "suspended" || sLower === "suspension" || sLower === "s" ||
    sLower === "sus" || sLower === "oss" || sLower === "iss" ||
    /^(OSS|ISS|SUS)$/i.test(code)
  ) {
    // ISS counts as present for ADA; OSS does not — but for the simplified
    // status field we mark as "suspended", canonical mapping handles the rest
    return { status: "suspended", absence_type: "unexcused" };
  }
  if (/suspen/i.test(s)) {
    warning = `"${s}" interpreted as Suspended`;
    return { status: "suspended", absence_type: "unexcused", warning };
  }

  // ===================================================================
  // ABSENT detection
  // ===================================================================
  if (
    sLower === "absent" || sLower === "a" || sLower === "abs" || sLower === "ab" ||
    sLower === "1" || // Aeries ATT.AL: 1 = absent
    sLower === "au" || sLower === "ae" || sLower === "ax" || sLower === "aex"
  ) {
    const exc = sLower === "ae" || sLower === "aex"
      ? "excused"
      : sLower === "au" || sLower === "ax"
        ? "unexcused"
        : resolveExcused();
    return { status: "absent", absence_type: exc ?? "unexcused" };
  }

  // Descriptive absent strings
  if (/absent/i.test(s)) {
    const exc = resolveExcused();
    const inferred = /unexcused/i.test(s) ? "unexcused" : /excused/i.test(s) ? "excused" : exc;
    return { status: "absent", absence_type: inferred ?? "unexcused" };
  }

  // Unexcused keywords as primary status
  if (sLower === "unex" || sLower === "unexcused" || sLower === "unexcused absence") {
    return { status: "absent", absence_type: "unexcused" };
  }
  if (/unexcused/i.test(s)) {
    warning = `"${s}" interpreted as Absent (unexcused)`;
    return { status: "absent", absence_type: "unexcused", warning };
  }

  // Excused keyword as status (some SIS put "Excused" as the status)
  if (sLower === "excused" || sLower === "excused absence") {
    return { status: "absent", absence_type: "excused" };
  }
  if (/excused/i.test(s) && !/unexcused/i.test(s)) {
    warning = `"${s}" interpreted as Absent (excused)`;
    return { status: "absent", absence_type: "excused", warning };
  }

  // Reason-as-status patterns (illness, medical, etc.)
  if (/^(ill(ness)?|sick)$/i.test(sLower)) {
    return { status: "absent", absence_type: "excused", warning: `"${s}" interpreted as Absent (excused)` };
  }
  if (/^med(ical)?(\s+appo?i?n?t?m?e?n?t?)?$/i.test(sLower)) {
    return { status: "absent", absence_type: "excused", warning: `"${s}" interpreted as Absent (excused)` };
  }
  if (/^(funeral|bereavement|religious|dental|doctor|hospitalized)$/i.test(sLower)) {
    return { status: "absent", absence_type: "excused", warning: `"${s}" interpreted as Absent (excused)` };
  }

  // Absence code used as status (common Aeries pattern)
  if (/^[AaUuEe]\d{0,2}$/.test(s) && s.length <= 3) {
    const first = s[0].toUpperCase();
    if (first === "A") {
      const exc = resolveExcused();
      warning = `"${s}" interpreted as Absent`;
      return { status: "absent", absence_type: exc ?? "unexcused", warning };
    }
    if (first === "U") {
      warning = `"${s}" interpreted as Absent (unexcused)`;
      return { status: "absent", absence_type: "unexcused", warning };
    }
    if (first === "E") {
      warning = `"${s}" interpreted as Absent (excused)`;
      return { status: "absent", absence_type: "excused", warning };
    }
  }

  // ===================================================================
  // BLANK / EMPTY — treat as present (absence-only export pattern)
  // ===================================================================
  if (s === "") {
    return { status: "present", absence_type: null };
  }

  // ===================================================================
  // FALLBACK — unrecognized
  // ===================================================================
  return {
    status: "absent",
    absence_type: "unexcused",
    warning: `"${s}" not recognized, defaulting to Absent (unexcused)`,
  };
}

/* ------------------------------------------------------------------ */
/* Grade normalization                                                 */
/* ------------------------------------------------------------------ */

const GRADE_MAP: Record<string, string> = {
  pk: "PK",
  prek: "PK",
  "pre-k": "PK",
  prekindergarten: "PK",
  "pre-kindergarten": "PK",
  tk: "TK",
  "transitional kindergarten": "TK",
  k: "K",
  kindergarten: "K",
  kinder: "K",
};

export function normalizeGrade(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";

  if (GRADE_MAP[s]) return GRADE_MAP[s];

  // Numeric grades: "01" → "1", "12" → "12"
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return String(num);
  }

  // Already valid single digits
  if (/^\d{1,2}$/.test(s)) return s;

  return raw.trim();
}

/* ------------------------------------------------------------------ */
/* Absence type normalization (standalone, for legacy column)          */
/* ------------------------------------------------------------------ */

const ABSENCE_TYPE_MAP: Record<string, string> = {
  excused: "excused",
  e: "excused",
  ex: "excused",
  y: "excused",
  yes: "excused",
  unexcused: "unexcused",
  u: "unexcused",
  un: "unexcused",
  unex: "unexcused",
  n: "unexcused",
  no: "unexcused",
  tardy: "tardy",
  t: "tardy",
};

export function normalizeAbsenceType(raw: string): string {
  return ABSENCE_TYPE_MAP[raw.trim().toLowerCase()] ?? "";
}

/* ------------------------------------------------------------------ */
/* Row normalization                                                   */
/* ------------------------------------------------------------------ */

/**
 * Applies column mapping to a raw CSV row, normalizing all values.
 * Uses the enhanced normalizeStatus with layered inputs.
 */
/**
 * Splits a combined name into first and last.
 * Supports "Last, First" (comma) and "First Last" (space) patterns.
 */
function splitCombinedName(fullName: string): { first: string; last: string } {
  const s = fullName.trim();
  if (!s) return { first: "", last: "" };

  // "Last, First" or "Last, First Middle"
  const commaIdx = s.indexOf(",");
  if (commaIdx > 0) {
    const last = s.slice(0, commaIdx).trim();
    const first = s.slice(commaIdx + 1).trim().split(/\s+/)[0] ?? "";
    return { first, last };
  }

  // "First Last" — split on last space
  const spaceIdx = s.lastIndexOf(" ");
  if (spaceIdx > 0) {
    return {
      first: s.slice(0, spaceIdx).trim(),
      last: s.slice(spaceIdx + 1).trim(),
    };
  }

  // Single word — treat as last name
  return { first: "", last: s };
}

export function normalizeRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  rowIndex: number
): NormalizedRow {
  const mapped: Record<string, string> = {};

  for (const [csvHeader, edveraField] of Object.entries(mapping)) {
    if (edveraField !== "skip" && raw[csvHeader] !== undefined) {
      mapped[edveraField] = raw[csvHeader]?.trim() ?? "";
    }
  }

  // Handle combined name field → split into first_name + last_name
  if (mapped.full_name_last_first && (!mapped.first_name || !mapped.last_name)) {
    const { first, last } = splitCombinedName(mapped.full_name_last_first);
    if (!mapped.first_name) mapped.first_name = first;
    if (!mapped.last_name) mapped.last_name = last;
  }

  const rawStatus = mapped.status ?? "";
  const rawAbsenceCode = mapped.absence_code ?? "";
  const rawAbsenceType = mapped.absence_type ?? "";
  const rawExcusedFlag = mapped.excused_flag ?? "";

  // If no status column mapped but we have an absence_code or absence_type,
  // try to derive status from those fields
  let statusInput = rawStatus;
  if (!statusInput && rawAbsenceCode) {
    statusInput = rawAbsenceCode;
  }
  if (!statusInput && rawAbsenceType) {
    statusInput = rawAbsenceType;
  }

  const result = normalizeStatus(statusInput, rawAbsenceCode, rawAbsenceType, rawExcusedFlag);

  // Normalize gender to single uppercase letter (M/F/X)
  const rawGender = (mapped.gender ?? "").trim().toLowerCase();
  let normalizedGender = "";
  if (rawGender === "m" || rawGender === "male") normalizedGender = "M";
  else if (rawGender === "f" || rawGender === "female") normalizedGender = "F";
  else if (rawGender === "x" || rawGender === "non-binary" || rawGender === "nonbinary") normalizedGender = "X";
  else if (rawGender) normalizedGender = rawGender.toUpperCase();

  return {
    student_sis_id: mapped.student_sis_id ?? "",
    first_name: mapped.first_name ?? "",
    last_name: mapped.last_name ?? "",
    grade_level: normalizeGrade(mapped.grade_level ?? ""),
    school_name: mapped.school_name ?? "",
    attendance_date: normalizeDate(mapped.attendance_date ?? ""),
    status: result.status,
    absence_code: rawAbsenceCode,
    absence_type: result.absence_type ?? "",
    ssid: (mapped.ssid ?? "").trim(),
    date_of_birth: normalizeDate(mapped.date_of_birth ?? ""),
    gender: normalizedGender,
    _raw_row_index: rowIndex,
    _status_normalized_from: rawStatus || undefined,
    _status_warning: result.warning,
  };
}

/* ------------------------------------------------------------------ */
/* Row validation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Validates a normalized row. Caller should provide a Set<string> of
 * "studentId::date" keys to detect duplicates (and add to it).
 */
export function validateRow(
  row: NormalizedRow,
  seenKeys: Set<string>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!row.student_sis_id) errors.push("Missing student ID");
  if (!row.first_name) errors.push("Missing first name");
  if (!row.last_name) errors.push("Missing last name");
  if (!row.attendance_date) errors.push("Invalid or missing date");

  // Status is always set by normalizeStatus (even unrecognized → fallback)
  // so we only error if truly empty (shouldn't happen)
  if (!row.status) errors.push("Invalid or missing status");

  // Normalization warning → propagate as validation warning
  if (row._status_warning) {
    warnings.push(row._status_warning);
  }

  // Date validity check
  if (row.attendance_date) {
    const d = new Date(row.attendance_date + "T00:00:00");
    if (isNaN(d.getTime())) {
      errors.push("Date is not a valid calendar date");
    }
  }

  // Grade validation (non-fatal warning)
  if (row.grade_level) {
    const validGrades = new Set([
      "PK", "TK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
    ]);
    if (!validGrades.has(row.grade_level)) {
      warnings.push(`Grade "${row.grade_level}" may not be standard`);
    }
  }

  // Default warnings
  if (row.status === "absent" && !row.absence_type) {
    warnings.push("Missing absence type — will default to unexcused");
  }

  // Duplicate check
  if (row.student_sis_id && row.attendance_date) {
    const key = `${row.student_sis_id}::${row.attendance_date}`;
    if (seenKeys.has(key)) {
      warnings.push("Duplicate: same student + date appears earlier in file");
    } else {
      seenKeys.add(key);
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/* ------------------------------------------------------------------ */
/* Absence-only export detection                                       */
/* ------------------------------------------------------------------ */

/**
 * Detects if a CSV appears to be an absence-only export (no present rows).
 * Returns true if every row has a non-present status.
 */
export function detectAbsenceOnlyExport(
  rows: NormalizedRow[]
): boolean {
  if (rows.length === 0) return false;
  return rows.every((r) => r.status !== "present");
}

/* ------------------------------------------------------------------ */
/* Normalization summary builder                                       */
/* ------------------------------------------------------------------ */

/**
 * Builds a summary of how raw status values were mapped to canonical statuses.
 * Groups by normalized output and collects unique raw input values.
 */
export function buildNormalizationSummary(
  rows: NormalizedRow[]
): NormalizationEntry[] {
  const map = new Map<string, { rawValues: Set<string>; count: number }>();

  for (const row of rows) {
    const rawVal = row._status_normalized_from ?? "(blank)";
    const normalized =
      row.status === "absent" && row.absence_type === "excused"
        ? "Absent (excused)"
        : row.status === "absent"
          ? "Absent (unexcused)"
          : row.status === "tardy" && row.absence_type === "excused"
            ? "Tardy (excused)"
            : row.status === "tardy"
              ? "Tardy"
              : row.status === "suspended"
                ? "Suspended"
                : "Present";

    const entry = map.get(normalized) ?? { rawValues: new Set(), count: 0 };
    if (rawVal) entry.rawValues.add(rawVal);
    entry.count++;
    map.set(normalized, entry);
  }

  return [...map.entries()]
    .map(([normalizedTo, data]) => ({
      normalizedTo,
      rawValues: [...data.rawValues].slice(0, 5), // cap at 5 unique values shown
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* School fuzzy matching                                               */
/* ------------------------------------------------------------------ */

/**
 * Strips common school type suffixes for fuzzy comparison.
 */
function stripSchoolSuffix(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\s+(elementary school|middle school|high school|school|elem|ms|hs|es)$/i,
      ""
    )
    .trim();
}

/**
 * Fuzzy matches a school name from CSV to existing schools.
 * Returns the best match or null.
 */
export function fuzzyMatchSchool(
  schoolName: string,
  existingSchools: { id: string; name: string }[]
): { id: string; name: string } | null {
  if (!schoolName) return null;
  const target = schoolName.trim().toLowerCase();
  const targetStripped = stripSchoolSuffix(schoolName);

  // Exact match (case-insensitive)
  for (const school of existingSchools) {
    if (school.name.toLowerCase() === target) return school;
  }

  // Stripped match
  for (const school of existingSchools) {
    if (stripSchoolSuffix(school.name) === targetStripped) return school;
  }

  // Contains match (either direction)
  for (const school of existingSchools) {
    const schoolLower = school.name.toLowerCase();
    if (schoolLower.includes(target) || target.includes(schoolLower)) {
      return school;
    }
  }

  // Stripped contains
  for (const school of existingSchools) {
    const schoolStripped = stripSchoolSuffix(school.name);
    if (
      schoolStripped.includes(targetStripped) ||
      targetStripped.includes(schoolStripped)
    ) {
      return school;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Map CSV status → canonical_type                                     */
/* ------------------------------------------------------------------ */

/**
 * Maps the simplified CSV status + absence_type to the canonical
 * absence_type enum used in attendance_daily.
 */
export function mapToCanonicalType(
  status: string,
  absenceType: string
): string {
  if (status === "present") return "present";
  if (status === "tardy") {
    return absenceType === "excused" ? "tardy_excused" : "tardy_unexcused";
  }
  if (status === "suspended") return "suspension_out_of_school";
  // absent
  if (absenceType === "excused") return "absent_excused";
  return "absent_unexcused";
}

/**
 * Returns ADA and truancy flags from canonical type.
 */
export function getAttendanceFlags(canonicalType: string): {
  counts_for_ada: boolean;
  counts_as_truancy: boolean;
} {
  switch (canonicalType) {
    case "present":
    case "tardy":
    case "tardy_excused":
    case "tardy_unexcused":
      return { counts_for_ada: true, counts_as_truancy: false };
    case "absent_excused":
      return { counts_for_ada: false, counts_as_truancy: false };
    case "absent_unexcused":
      return { counts_for_ada: false, counts_as_truancy: true };
    case "suspension_in_school":
      return { counts_for_ada: true, counts_as_truancy: false };
    case "suspension_out_of_school":
      return { counts_for_ada: false, counts_as_truancy: false };
    default:
      return { counts_for_ada: false, counts_as_truancy: false };
  }
}
