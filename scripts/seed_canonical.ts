/**
 * Edvera Canonical Schema Seed Script
 *
 * Populates the canonical tables with realistic synthetic data for
 * "Pacific Unified School District" — a fictional CA district for 2025-2026.
 *
 * Usage: npx tsx scripts/seed_canonical.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// ENV — dotenv loads .env from cwd automatically via "dotenv/config"
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing VITE_SUPABASE_URL in .env");
  process.exit(1);
}
if (!SUPABASE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env (required to bypass RLS)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// SEEDED PRNG (deterministic runs)
// ---------------------------------------------------------------------------
let _seed = 42;
function rand(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// DATE HELPERS
// ---------------------------------------------------------------------------
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function dayOfWeek(d: Date): number {
  return d.getDay(); // 0=Sun, 6=Sat
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const ACADEMIC_YEAR = "2025-2026";
const YEAR_START = new Date("2025-08-11"); // Mon
const YEAR_END = new Date("2026-06-04"); // Thu
const PER_PUPIL_DAILY_RATE = 65;
const TOTAL_INSTRUCTIONAL_DAYS = 180; // target

// School configs
interface SchoolConfig {
  name: string;
  sisCode: string;
  cdsCode: string;
  gradeLow: string;
  gradeHigh: string;
  grades: string[];
  schoolType: string;
  studentCount: number;
  absenceMultiplier: number;
  address: string;
  phone: string;
  principal: string;
}

const SCHOOLS: SchoolConfig[] = [
  {
    name: "Bayshore Elementary",
    sisCode: "101",
    cdsCode: "19-64857-0112345",
    gradeLow: "K",
    gradeHigh: "5",
    grades: ["K", "1", "2", "3", "4", "5"],
    schoolType: "elementary",
    studentCount: 100,
    absenceMultiplier: 0.8,
    address: "1200 Bayshore Dr",
    phone: "(310) 555-0101",
    principal: "Dr. Maria Gonzalez",
  },
  {
    name: "Hillcrest Middle",
    sisCode: "201",
    cdsCode: "19-64857-0212345",
    gradeLow: "6",
    gradeHigh: "8",
    grades: ["6", "7", "8"],
    schoolType: "middle",
    studentCount: 100,
    absenceMultiplier: 1.0,
    address: "850 Hillcrest Blvd",
    phone: "(310) 555-0201",
    principal: "Mr. James Washington",
  },
  {
    name: "Pacific High",
    sisCode: "301",
    cdsCode: "19-64857-0312345",
    gradeLow: "9",
    gradeHigh: "12",
    grades: ["9", "10", "11", "12"],
    schoolType: "high",
    studentCount: 100,
    absenceMultiplier: 1.15,
    address: "2400 Pacific Coast Hwy",
    phone: "(310) 555-0301",
    principal: "Ms. Jennifer Park",
  },
];

// Attendance pattern tiers (probability of being absent on any given school day)
// These are base daily absence probabilities. The school multiplier adjusts them.
interface AttendanceTier {
  name: string;
  weight: number; // fraction of students in this tier
  dailyAbsenceRate: number; // probability absent on a given day
  excusedRatio: number; // what fraction of absences are excused
  tardyRate: number; // probability of tardy (if not absent)
  burstProb: number; // probability of a consecutive-absence burst per month
  burstLength: [number, number]; // min/max consecutive days in a burst
}

const TIERS: AttendanceTier[] = [
  {
    name: "excellent",
    weight: 0.25,
    dailyAbsenceRate: 0.015,
    excusedRatio: 0.85,
    tardyRate: 0.01,
    burstProb: 0.05,
    burstLength: [1, 2],
  },
  {
    name: "good",
    weight: 0.25,
    dailyAbsenceRate: 0.03,
    excusedRatio: 0.75,
    tardyRate: 0.02,
    burstProb: 0.08,
    burstLength: [1, 3],
  },
  {
    name: "moderate",
    weight: 0.15,
    dailyAbsenceRate: 0.05,
    excusedRatio: 0.6,
    tardyRate: 0.03,
    burstProb: 0.12,
    burstLength: [2, 3],
  },
  {
    name: "at_risk",
    weight: 0.12,
    dailyAbsenceRate: 0.075,
    excusedRatio: 0.45,
    tardyRate: 0.04,
    burstProb: 0.15,
    burstLength: [2, 4],
  },
  {
    name: "drifting",
    weight: 0.08,
    dailyAbsenceRate: 0.1,
    excusedRatio: 0.35,
    tardyRate: 0.05,
    burstProb: 0.2,
    burstLength: [2, 5],
  },
  {
    name: "chronic",
    weight: 0.08,
    dailyAbsenceRate: 0.14,
    excusedRatio: 0.3,
    tardyRate: 0.05,
    burstProb: 0.25,
    burstLength: [3, 6],
  },
  {
    name: "severe",
    weight: 0.04,
    dailyAbsenceRate: 0.2,
    excusedRatio: 0.25,
    tardyRate: 0.06,
    burstProb: 0.3,
    burstLength: [3, 8],
  },
  {
    name: "acute",
    weight: 0.03,
    dailyAbsenceRate: 0.3,
    excusedRatio: 0.2,
    tardyRate: 0.06,
    burstProb: 0.35,
    burstLength: [4, 10],
  },
];

// ---------------------------------------------------------------------------
// DEMOGRAPHIC DATA POOLS
// ---------------------------------------------------------------------------
const HISPANIC_LAST_NAMES = [
  "Garcia", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Perez", "Sanchez", "Ramirez", "Torres", "Flores", "Rivera", "Gomez",
  "Diaz", "Cruz", "Reyes", "Morales", "Ortiz", "Gutierrez", "Chavez",
  "Ramos", "Vargas", "Castillo", "Jimenez", "Mendoza", "Ruiz", "Alvarez",
  "Romero", "Herrera", "Medina", "Aguilar", "Garza", "Castro", "Vasquez",
  "Soto", "Delgado", "Pena", "Sandoval", "Dominguez", "Contreras",
];
const WHITE_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller",
  "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White",
  "Harris", "Martin", "Thompson", "Robinson", "Clark", "Lewis",
  "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott",
  "Green", "Baker", "Adams", "Nelson", "Hill", "Campbell", "Mitchell",
  "Roberts", "Carter", "Phillips", "Evans", "Turner", "Collins",
];
const ASIAN_LAST_NAMES = [
  "Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Huang", "Wu", "Kim",
  "Park", "Lee", "Nguyen", "Tran", "Pham", "Patel", "Shah", "Singh",
  "Gupta", "Kumar", "Tanaka", "Suzuki", "Takahashi", "Watanabe", "Yamamoto",
  "Nakamura", "Ito", "Hayashi", "Saito", "Lin", "Ho",
];
const BLACK_LAST_NAMES = [
  "Washington", "Jefferson", "Franklin", "Brooks", "Coleman", "Hayes",
  "Howard", "Jenkins", "Powell", "Reed", "Russell", "Sanders", "Simmons",
  "Stewart", "Tucker", "Ward", "Watson", "Gray", "Grant", "Hamilton",
  "Henderson", "Hunt", "Lawrence", "Marshall", "Mason", "Morris",
  "Palmer", "Patterson", "Porter", "Price",
];
const OTHER_LAST_NAMES = [
  "Ali", "Mohamed", "Hassan", "Farsi", "Abdi", "Osman",
  "Kaur", "Gill", "Grewal", "Sidhu",
  "Kekoa", "Tuiloma", "Faaumu", "Samoa",
  "Redbird", "Littlefeather", "Whitehawk", "Blackwater",
];

const MALE_FIRST_NAMES = [
  "James", "Liam", "Noah", "Oliver", "Elijah", "Lucas", "Mason",
  "Logan", "Alexander", "Ethan", "Jacob", "Michael", "Daniel", "Henry",
  "Sebastian", "Mateo", "Jack", "Owen", "Theodore", "Aiden",
  "Santiago", "Diego", "Carlos", "Miguel", "Angel", "Luis", "Jose",
  "Juan", "David", "Adrian", "Kevin", "Anthony", "Christopher",
  "Nathan", "Ryan", "Isaiah", "Jayden", "Gabriel", "Caleb", "Josiah",
];
const FEMALE_FIRST_NAMES = [
  "Olivia", "Emma", "Charlotte", "Amelia", "Sophia", "Isabella", "Mia",
  "Evelyn", "Harper", "Luna", "Camila", "Sofia", "Scarlett", "Elizabeth",
  "Eleanor", "Emily", "Chloe", "Mila", "Aria", "Penelope",
  "Maria", "Valentina", "Guadalupe", "Elena", "Lucia", "Rosa", "Ana",
  "Carmen", "Catalina", "Isabella", "Jasmine", "Aaliyah", "Maya",
  "Zoe", "Lily", "Grace", "Hannah", "Abigail", "Madison", "Ella",
];

const STREETS = [
  "Oak", "Maple", "Cedar", "Pine", "Elm", "Birch", "Willow", "Palm",
  "Magnolia", "Cypress", "Olive", "Laurel", "Ash", "Sycamore", "Walnut",
  "Cherry", "Poplar", "Spruce", "Juniper", "Hazel",
];
const STREET_TYPES = ["St", "Ave", "Dr", "Ln", "Ct", "Blvd", "Way", "Pl"];
const CITIES = ["Pacific Beach", "Ocean View", "Bayshore", "Hillcrest", "Seaside"];
const ZIPS = ["90210", "90211", "90212", "90213", "90214"];

// CA race codes (CDE reporting)
const RACE_CODES: Record<string, string[]> = {
  hispanic: ["700"], // Hispanic
  white: ["600"],
  asian: ["400"],
  black: ["500"],
  other: ["200", "300", "100"], // pacific islander, AIAN, 2+
};

// Absence codes — typical Aeries CA district config
const ABSENCE_CODES = [
  // Unverified absences
  { sis_code: "A", sis_description: "Unverified Absence", sis_type_id: "1", canonical_type: "absent_unverified" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Unverified Absence", display_abbreviation: "UNV" },
  // Excused absences
  { sis_code: "E", sis_description: "Excused Absence - Illness", sis_type_id: "2", canonical_type: "absent_excused" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Excused Absence - Illness", display_abbreviation: "EXC" },
  { sis_code: "D", sis_description: "Excused Absence - Medical/Dental", sis_type_id: "2", canonical_type: "absent_excused" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Excused Medical/Dental", display_abbreviation: "MED" },
  { sis_code: "F", sis_description: "Excused Absence - Funeral", sis_type_id: "2", canonical_type: "absent_excused" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Excused Funeral", display_abbreviation: "FUN" },
  { sis_code: "R", sis_description: "Excused Absence - Religious", sis_type_id: "2", canonical_type: "absent_excused" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Excused Religious", display_abbreviation: "REL" },
  // Unexcused absences
  { sis_code: "U", sis_description: "Unexcused Absence", sis_type_id: "3", canonical_type: "absent_unexcused" as const, counts_for_ada: false, counts_as_truancy: true, is_suspension: false, is_independent_study: false, display_name: "Unexcused Absence", display_abbreviation: "UNX" },
  { sis_code: "C", sis_description: "Unexcused - Cut Class", sis_type_id: "3", canonical_type: "absent_unexcused" as const, counts_for_ada: false, counts_as_truancy: true, is_suspension: false, is_independent_study: false, display_name: "Cut Class", display_abbreviation: "CUT" },
  // Tardy
  { sis_code: "T", sis_description: "Tardy Unexcused", sis_type_id: "5", canonical_type: "tardy_unexcused" as const, counts_for_ada: true, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Tardy Unexcused", display_abbreviation: "TDU" },
  { sis_code: "L", sis_description: "Tardy Excused", sis_type_id: "8", canonical_type: "tardy_excused" as const, counts_for_ada: true, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Tardy Excused", display_abbreviation: "TDE" },
  { sis_code: "N", sis_description: "Tardy 30+ Minutes", sis_type_id: "9", canonical_type: "tardy_unexcused" as const, counts_for_ada: true, counts_as_truancy: true, is_suspension: false, is_independent_study: false, display_name: "Tardy 30+ Min", display_abbreviation: "T30" },
  // Suspensions
  { sis_code: "S", sis_description: "Suspension Out-of-School", sis_type_id: "3", canonical_type: "suspension_out_of_school" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: true, is_independent_study: false, display_name: "Suspension (Out)", display_abbreviation: "SUS" },
  { sis_code: "I", sis_description: "Suspension In-School", sis_type_id: "6", canonical_type: "suspension_in_school" as const, counts_for_ada: true, counts_as_truancy: false, is_suspension: true, is_independent_study: false, display_name: "Suspension (In)", display_abbreviation: "ISS" },
  // Independent study
  { sis_code: "J", sis_description: "Independent Study - Complete", sis_type_id: "6", canonical_type: "independent_study_complete" as const, counts_for_ada: true, counts_as_truancy: false, is_suspension: false, is_independent_study: true, display_name: "Indep. Study (Complete)", display_abbreviation: "ISC" },
  { sis_code: "K", sis_description: "Independent Study - Incomplete", sis_type_id: "1", canonical_type: "independent_study_incomplete" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: true, display_name: "Indep. Study (Incomplete)", display_abbreviation: "ISI" },
  // School activity (counts as present)
  { sis_code: "H", sis_description: "School Activity - Field Trip", sis_type_id: "6", canonical_type: "present" as const, counts_for_ada: true, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Field Trip", display_abbreviation: "FLD" },
  { sis_code: "O", sis_description: "Other Excused", sis_type_id: "2", canonical_type: "absent_excused" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Other Excused", display_abbreviation: "OTH" },
  // Not enrolled (used during gaps)
  { sis_code: "X", sis_description: "Not Enrolled", sis_type_id: "1", canonical_type: "not_enrolled" as const, counts_for_ada: false, counts_as_truancy: false, is_suspension: false, is_independent_study: false, display_name: "Not Enrolled", display_abbreviation: "NEN" },
];

// Holidays/breaks for 2025-2026 CA school year
const HOLIDAYS: Record<string, string> = {
  "2025-09-01": "Labor Day",
  "2025-11-11": "Veterans Day",
  "2025-11-24": "Thanksgiving Break",
  "2025-11-25": "Thanksgiving Break",
  "2025-11-26": "Thanksgiving Break",
  "2025-11-27": "Thanksgiving Day",
  "2025-11-28": "Thanksgiving Break",
  "2025-12-22": "Winter Break",
  "2025-12-23": "Winter Break",
  "2025-12-24": "Winter Break",
  "2025-12-25": "Christmas Day",
  "2025-12-26": "Winter Break",
  "2025-12-29": "Winter Break",
  "2025-12-30": "Winter Break",
  "2025-12-31": "New Year's Eve",
  "2026-01-01": "New Year's Day",
  "2026-01-02": "Winter Break",
  "2026-01-19": "MLK Jr. Day",
  "2026-02-09": "Lincoln's Birthday",
  "2026-02-16": "Presidents' Day",
  "2026-03-30": "Spring Break",
  "2026-03-31": "Spring Break",
  "2026-04-01": "Spring Break",
  "2026-04-02": "Spring Break",
  "2026-04-03": "Spring Break",
  "2026-05-25": "Memorial Day",
};

const PD_DAYS: Record<string, string> = {
  "2025-10-13": "Professional Development Day",
  "2026-01-05": "PD Day - Staff In-Service",
  "2026-02-02": "PD Day",
  "2026-04-06": "PD Day - Post-Break",
};

// ---------------------------------------------------------------------------
// CALENDAR GENERATION
// ---------------------------------------------------------------------------
interface CalendarDay {
  calendar_date: string;
  is_school_day: boolean;
  day_type: string;
  attendance_month: number;
  notes: string | null;
}

function generateCalendar(): CalendarDay[] {
  const days: CalendarDay[] = [];
  let d = new Date(YEAR_START);
  const end = new Date(YEAR_END);

  while (d <= end) {
    const ds = dateStr(d);
    const dow = dayOfWeek(d);
    const month = d.getMonth() + 1;

    if (dow === 0 || dow === 6) {
      // weekend — skip entirely, not in calendar
      d = addDays(d, 1);
      continue;
    }

    if (HOLIDAYS[ds]) {
      days.push({
        calendar_date: ds,
        is_school_day: false,
        day_type: "holiday",
        attendance_month: month,
        notes: HOLIDAYS[ds],
      });
    } else if (PD_DAYS[ds]) {
      days.push({
        calendar_date: ds,
        is_school_day: false,
        day_type: "pd_day",
        attendance_month: month,
        notes: PD_DAYS[ds],
      });
    } else {
      days.push({
        calendar_date: ds,
        is_school_day: true,
        day_type: "regular",
        attendance_month: month,
        notes: null,
      });
    }

    d = addDays(d, 1);
  }

  return days;
}

// ---------------------------------------------------------------------------
// STUDENT GENERATION
// ---------------------------------------------------------------------------
interface StudentRecord {
  sis_student_id: string;
  state_student_id: string;
  student_number: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  gender: string;
  birth_date: string;
  grade_level: string;
  ethnicity_code: string;
  race_codes: string[];
  home_language_code: string;
  language_fluency: string;
  correspondence_language: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  is_active: boolean;
  // internal tracking
  _tier: AttendanceTier;
  _ethnicity: string;
}

let _studentIdCounter = 10001;

function generateStudents(school: SchoolConfig): StudentRecord[] {
  const students: StudentRecord[] = [];
  const studentsPerGrade = Math.floor(school.studentCount / school.grades.length);

  for (const grade of school.grades) {
    const count =
      grade === school.grades[school.grades.length - 1]
        ? school.studentCount - studentsPerGrade * (school.grades.length - 1)
        : studentsPerGrade;

    for (let i = 0; i < count; i++) {
      // Demographics: weighted ethnicity
      const ethnicity = weightedPick(
        ["hispanic", "white", "asian", "black", "other"],
        [55, 21, 10, 8, 6]
      );

      // Pick name pools based on ethnicity
      const lastNames =
        ethnicity === "hispanic" ? HISPANIC_LAST_NAMES :
        ethnicity === "white" ? WHITE_LAST_NAMES :
        ethnicity === "asian" ? ASIAN_LAST_NAMES :
        ethnicity === "black" ? BLACK_LAST_NAMES :
        OTHER_LAST_NAMES;

      const gender = rand() < 0.5 ? "M" : "F";
      const firstNames = gender === "M" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;

      // Language — 18% EL overall, heavily correlated with Hispanic
      let languageFluency: string;
      let homeLanguageCode: string;
      let correspondenceLanguage: string;
      if (ethnicity === "hispanic") {
        const langRoll = rand();
        if (langRoll < 0.30) {
          languageFluency = "EL";
          homeLanguageCode = "es";
          correspondenceLanguage = "01"; // Spanish
        } else if (langRoll < 0.45) {
          languageFluency = "RFEP";
          homeLanguageCode = "es";
          correspondenceLanguage = "01";
        } else if (langRoll < 0.55) {
          languageFluency = "IFEP";
          homeLanguageCode = "es";
          correspondenceLanguage = "00"; // English
        } else {
          languageFluency = "EO";
          homeLanguageCode = "en";
          correspondenceLanguage = "00";
        }
      } else if (ethnicity === "asian") {
        const langRoll = rand();
        if (langRoll < 0.15) {
          languageFluency = "EL";
          homeLanguageCode = pick(["zh", "vi", "tl", "ko", "ja"]);
          correspondenceLanguage = "00";
        } else if (langRoll < 0.25) {
          languageFluency = "RFEP";
          homeLanguageCode = pick(["zh", "vi", "tl"]);
          correspondenceLanguage = "00";
        } else {
          languageFluency = "EO";
          homeLanguageCode = "en";
          correspondenceLanguage = "00";
        }
      } else {
        languageFluency = "EO";
        homeLanguageCode = "en";
        correspondenceLanguage = "00";
      }

      // Birth date: reasonable for grade level
      const gradeNum =
        grade === "K" ? 0 : grade === "TK" ? -1 : parseInt(grade, 10);
      const birthYear = 2025 - 5 - gradeNum + (rand() < 0.5 ? 0 : -1);
      const birthMonth = randInt(1, 12);
      const birthDay = randInt(1, 28);

      // Attendance tier
      const tier = weightedPick(
        TIERS,
        TIERS.map((t) => t.weight)
      );

      const sid = _studentIdCounter++;
      students.push({
        sis_student_id: String(sid),
        state_student_id: String(1000000000 + sid),
        student_number: `S${sid}`,
        last_name: pick(lastNames),
        first_name: pick(firstNames),
        middle_name: rand() < 0.6 ? pick(firstNames).charAt(0) : null,
        gender,
        birth_date: `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
        grade_level: grade,
        ethnicity_code: ethnicity === "hispanic" ? "H" : "N",
        race_codes: RACE_CODES[ethnicity] || ["600"],
        home_language_code: homeLanguageCode,
        language_fluency: languageFluency,
        correspondence_language: correspondenceLanguage,
        address_street: `${randInt(100, 9999)} ${pick(STREETS)} ${pick(STREET_TYPES)}`,
        address_city: pick(CITIES),
        address_state: "CA",
        address_zip: pick(ZIPS),
        is_active: true,
        _tier: tier,
        _ethnicity: ethnicity,
      });
    }
  }

  return students;
}

// ---------------------------------------------------------------------------
// CONTACT GENERATION
// ---------------------------------------------------------------------------
interface ContactRecord {
  sequence_number: number;
  last_name: string;
  first_name: string;
  relationship: string;
  home_phone: string | null;
  work_phone: string | null;
  cell_phone: string;
  email: string;
  correspondence_language: string;
  notification_preference: string;
  is_educational_rights_holder: boolean;
  lives_with_student: boolean;
  is_emergency_contact: boolean;
}

function generateContacts(student: StudentRecord): ContactRecord[] {
  const contacts: ContactRecord[] = [];
  const numContacts = rand() < 0.55 ? 2 : 1;

  for (let seq = 0; seq < numContacts; seq++) {
    const isMother = seq === 0 ? rand() < 0.65 : rand() < 0.35;
    const rel = isMother ? "MO" : "FA";
    const fnames = isMother ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
    const areaCode = "310";
    const phone = `(${areaCode}) ${randInt(200, 999)}-${String(randInt(0, 9999)).padStart(4, "0")}`;
    const notifPref = student.correspondence_language === "01"
      ? weightedPick(["T", "B", "E", "N"], [40, 30, 20, 10])
      : weightedPick(["E", "B", "T", "N"], [40, 30, 20, 10]);

    contacts.push({
      sequence_number: seq,
      last_name: student.last_name,
      first_name: pick(fnames),
      relationship: rel,
      home_phone: rand() < 0.4 ? phone.replace(/\d{4}$/, String(randInt(0, 9999)).padStart(4, "0")) : null,
      work_phone: rand() < 0.3 ? phone.replace(/\d{4}$/, String(randInt(0, 9999)).padStart(4, "0")) : null,
      cell_phone: phone,
      email: `${pick(fnames).toLowerCase()}.${student.last_name.toLowerCase()}${randInt(1, 99)}@${pick(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"])}`,
      correspondence_language: student.correspondence_language,
      notification_preference: notifPref,
      is_educational_rights_holder: seq === 0,
      lives_with_student: seq === 0 || rand() < 0.7,
      is_emergency_contact: true,
    });
  }

  return contacts;
}

// ---------------------------------------------------------------------------
// ATTENDANCE GENERATION
// ---------------------------------------------------------------------------
type CanonicalType =
  | "present"
  | "absent_unverified"
  | "absent_excused"
  | "absent_unexcused"
  | "tardy"
  | "tardy_excused"
  | "tardy_unexcused"
  | "suspension_in_school"
  | "suspension_out_of_school"
  | "independent_study_complete"
  | "independent_study_incomplete"
  | "not_enrolled";

interface AttendanceDayRecord {
  calendar_date: string;
  sis_absence_code: string | null;
  canonical_type: CanonicalType;
  counts_for_ada: boolean;
  counts_as_truancy: boolean;
}

function generateAttendance(
  student: StudentRecord,
  schoolDays: string[],
  absenceMultiplier: number,
  absenceCodeMap: Map<string, (typeof ABSENCE_CODES)[number]>
): AttendanceDayRecord[] {
  const tier = student._tier;
  const records: AttendanceDayRecord[] = [];
  const effectiveAbsenceRate = tier.dailyAbsenceRate * absenceMultiplier;

  // Pre-generate burst periods (consecutive absence blocks)
  const burstDays = new Set<string>();
  const numMonths = 10; // Aug-Jun
  for (let m = 0; m < numMonths; m++) {
    if (rand() < tier.burstProb) {
      // Pick a random school day in roughly this month's portion
      const startIdx = Math.floor((m / numMonths) * schoolDays.length);
      const endIdx = Math.min(
        Math.floor(((m + 1) / numMonths) * schoolDays.length),
        schoolDays.length - 1
      );
      const burstStart = randInt(startIdx, endIdx);
      const burstLen = randInt(tier.burstLength[0], tier.burstLength[1]);
      for (let b = 0; b < burstLen && burstStart + b < schoolDays.length; b++) {
        burstDays.add(schoolDays[burstStart + b]);
      }
    }
  }

  for (const day of schoolDays) {
    const d = new Date(day);
    const dow = dayOfWeek(d);
    const month = d.getMonth() + 1;

    // Seasonal illness spike: Jan-Feb ~1.3x, Nov ~1.15x
    let seasonalMult = 1.0;
    if (month === 1 || month === 2) seasonalMult = 1.3;
    else if (month === 11) seasonalMult = 1.15;

    // Monday/Friday clustering: 1.25x absence rate
    let dowMult = 1.0;
    if (dow === 1 || dow === 5) dowMult = 1.25;

    // Is this day in a burst?
    const inBurst = burstDays.has(day);

    // Determine if absent
    const isAbsent =
      inBurst || rand() < effectiveAbsenceRate * seasonalMult * dowMult;

    if (isAbsent) {
      // Decide type of absence
      const isExcused = rand() < tier.excusedRatio;

      if (isExcused) {
        // Pick an excused code
        const code = weightedPick(
          ["E", "D", "F", "R", "O"],
          [60, 15, 5, 5, 15]
        );
        const codeInfo = absenceCodeMap.get(code)!;
        records.push({
          calendar_date: day,
          sis_absence_code: code,
          canonical_type: codeInfo.canonical_type,
          counts_for_ada: codeInfo.counts_for_ada,
          counts_as_truancy: codeInfo.counts_as_truancy,
        });
      } else {
        // Unexcused — split between unverified and verified unexcused
        const roll = rand();
        let code: string;
        if (roll < 0.4) code = "A"; // unverified
        else if (roll < 0.85) code = "U"; // unexcused
        else code = "C"; // cut
        const codeInfo = absenceCodeMap.get(code)!;
        records.push({
          calendar_date: day,
          sis_absence_code: code,
          canonical_type: codeInfo.canonical_type,
          counts_for_ada: codeInfo.counts_for_ada,
          counts_as_truancy: codeInfo.counts_as_truancy,
        });
      }
    } else if (rand() < tier.tardyRate * absenceMultiplier) {
      // Tardy
      const code = rand() < 0.5 ? "T" : "L";
      const codeInfo = absenceCodeMap.get(code)!;
      records.push({
        calendar_date: day,
        sis_absence_code: code,
        canonical_type: codeInfo.canonical_type,
        counts_for_ada: codeInfo.counts_for_ada,
        counts_as_truancy: codeInfo.counts_as_truancy,
      });
    } else {
      // Present
      records.push({
        calendar_date: day,
        sis_absence_code: null,
        canonical_type: "present",
        counts_for_ada: true,
        counts_as_truancy: false,
      });
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// SNAPSHOT COMPUTATION
// ---------------------------------------------------------------------------
interface SnapshotRecord {
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
  attendance_rate: number;
  ada_rate: number;
  is_chronic_absent: boolean;
}

function computeSnapshot(attendance: AttendanceDayRecord[]): SnapshotRecord {
  const snap: SnapshotRecord = {
    days_enrolled: attendance.length,
    days_present: 0,
    days_absent: 0,
    days_absent_excused: 0,
    days_absent_unexcused: 0,
    days_tardy: 0,
    days_truant: 0,
    days_suspended: 0,
    days_independent_study_complete: 0,
    days_independent_study_incomplete: 0,
    days_suspended_in_school: 0,
    attendance_rate: 100,
    ada_rate: 100,
    is_chronic_absent: false,
  };

  let adaDays = 0;

  for (const rec of attendance) {
    if (rec.counts_for_ada) adaDays++;
    if (rec.counts_as_truancy) snap.days_truant++;

    switch (rec.canonical_type) {
      case "present":
        snap.days_present++;
        break;
      case "absent_unverified":
      case "absent_excused":
        snap.days_absent++;
        snap.days_absent_excused++;
        break;
      case "absent_unexcused":
        snap.days_absent++;
        snap.days_absent_unexcused++;
        break;
      case "tardy":
      case "tardy_excused":
      case "tardy_unexcused":
        snap.days_present++; // tardy counts as present
        snap.days_tardy++;
        break;
      case "suspension_out_of_school":
        snap.days_absent++;
        snap.days_suspended++;
        break;
      case "suspension_in_school":
        snap.days_present++; // in-school counts ADA
        snap.days_suspended_in_school++;
        break;
      case "independent_study_complete":
        snap.days_present++;
        snap.days_independent_study_complete++;
        break;
      case "independent_study_incomplete":
        snap.days_absent++;
        snap.days_independent_study_incomplete++;
        break;
      case "not_enrolled":
        snap.days_enrolled--;
        break;
    }
  }

  if (snap.days_enrolled > 0) {
    snap.attendance_rate = Math.round((snap.days_present / snap.days_enrolled) * 10000) / 100;
    snap.ada_rate = Math.round((adaDays / snap.days_enrolled) * 10000) / 100;
    snap.is_chronic_absent = snap.attendance_rate < 90;
  }

  return snap;
}

// ---------------------------------------------------------------------------
// RISK SIGNAL COMPUTATION (mirrors attendanceSignal.ts)
// ---------------------------------------------------------------------------
interface RiskSignalRecord {
  signal_level: "pending" | "stable" | "softening" | "elevated";
  signal_title: string;
  signal_subtitle: string;
  next_step: string | null;
  attendance_rate: number;
  consecutive_absences: number;
  total_days: number;
  last_30_rate: number;
  previous_30_rate: number;
  trend_delta: number;
  predicted_year_end_rate: number;
  predicted_chronic_risk_pct: number;
}

function computeRiskSignal(attendance: AttendanceDayRecord[]): RiskSignalRecord {
  const totalDays = attendance.length;

  // Count present days (tardy = present for signal purposes)
  let presentDays = 0;
  for (const r of attendance) {
    const ct = r.canonical_type;
    if (
      ct === "present" ||
      ct === "tardy" ||
      ct === "tardy_excused" ||
      ct === "tardy_unexcused" ||
      ct === "suspension_in_school" ||
      ct === "independent_study_complete"
    ) {
      presentDays++;
    }
  }

  const attendanceRate =
    totalDays > 0
      ? Math.round((presentDays / totalDays) * 1000) / 10
      : 100;

  // Consecutive absences from most recent day backwards
  let consecutiveAbsences = 0;
  for (let i = attendance.length - 1; i >= 0; i--) {
    const ct = attendance[i].canonical_type;
    if (
      ct === "absent_unverified" ||
      ct === "absent_excused" ||
      ct === "absent_unexcused" ||
      ct === "suspension_out_of_school" ||
      ct === "independent_study_incomplete"
    ) {
      consecutiveAbsences++;
    } else {
      break;
    }
  }

  // Last 30 school days vs previous 30
  const last30 = attendance.slice(-30);
  const prev30 = attendance.slice(-60, -30);

  function rateOf(days: AttendanceDayRecord[]): number {
    if (days.length === 0) return 100;
    let p = 0;
    for (const d of days) {
      const ct = d.canonical_type;
      if (
        ct === "present" || ct === "tardy" || ct === "tardy_excused" ||
        ct === "tardy_unexcused" || ct === "suspension_in_school" ||
        ct === "independent_study_complete"
      ) p++;
    }
    return Math.round((p / days.length) * 1000) / 10;
  }

  const last30Rate = rateOf(last30);
  const previous30Rate = rateOf(prev30);
  const trendDelta = Math.round((last30Rate - previous30Rate) * 10) / 10;

  // Predicted year-end rate (simple linear projection from current trend)
  const daysRemaining = TOTAL_INSTRUCTIONAL_DAYS - totalDays;
  const projectedRate =
    daysRemaining > 0
      ? Math.round(
          ((presentDays + (last30Rate / 100) * daysRemaining) /
            TOTAL_INSTRUCTIONAL_DAYS) *
            1000
        ) / 10
      : attendanceRate;

  // Probability of becoming chronic (< 90%)
  const chronicRiskPct =
    attendanceRate >= 98
      ? 2
      : attendanceRate >= 95
        ? 8
        : attendanceRate >= 92
          ? 25
          : attendanceRate >= 90
            ? 50
            : attendanceRate >= 85
              ? 75
              : 95;

  // Signal logic from attendanceSignal.ts
  let signal_level: "pending" | "stable" | "softening" | "elevated";
  let signal_title: string;
  let signal_subtitle: string;
  let next_step: string | null;

  if (totalDays < 5) {
    signal_level = "pending";
    signal_title = "Trend evaluation pending";
    signal_subtitle = "Not enough data to evaluate attendance trends.";
    next_step = null;
  } else if (attendanceRate < 90 || consecutiveAbsences >= 3) {
    signal_level = "elevated";
    signal_title = "Risk elevated";
    signal_subtitle = "Attendance below recommended threshold.";
    next_step = "Review recent absences.";
  } else if (
    (attendanceRate >= 90 && attendanceRate < 95) ||
    trendDelta <= -5
  ) {
    signal_level = "softening";
    signal_title = "Trend softening";
    signal_subtitle = "Recent absences increasing relative to baseline.";
    next_step = "Monitor closely over next 2 weeks.";
  } else {
    signal_level = "stable";
    signal_title = "Attendance stable";
    signal_subtitle = "No significant change detected.";
    next_step = null;
  }

  return {
    signal_level,
    signal_title,
    signal_subtitle,
    next_step,
    attendance_rate: attendanceRate,
    consecutive_absences: consecutiveAbsences,
    total_days: totalDays,
    last_30_rate: last30Rate,
    previous_30_rate: previous30Rate,
    trend_delta: trendDelta,
    predicted_year_end_rate: projectedRate,
    predicted_chronic_risk_pct: chronicRiskPct,
  };
}

// ---------------------------------------------------------------------------
// BATCH INSERT HELPER
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = 200
): Promise<{ id: string }[]> {
  const allResults: { id: string }[] = [];
  const totalBatches = Math.ceil(rows.length / batchSize);
  const MAX_RETRIES = 3;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = rows.slice(i, i + batchSize);
    if (totalBatches > 1) {
      process.stdout.write(
        `\r    ${table}: batch ${batchNum}/${totalBatches} (${Math.min(i + batchSize, rows.length)}/${rows.length} rows)`
      );
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        process.stdout.write(` [retry ${attempt}/${MAX_RETRIES}, wait ${backoff}ms]`);
        await sleep(backoff);
      }
      const { data, error } = await supabase
        .from(table)
        .insert(batch as any)
        .select("id");
      if (!error) {
        allResults.push(...(data || []));
        lastError = null;
        break;
      }
      lastError = error;
      // Only retry on transient socket/fetch errors
      if (!error.message?.includes("fetch failed") && !error.message?.includes("socket")) {
        console.error(`\nError inserting into ${table} (batch ${batchNum}/${totalBatches}):`, error.message);
        throw error;
      }
    }
    if (lastError) {
      console.error(`\nFailed after ${MAX_RETRIES} retries on ${table} (batch ${batchNum}/${totalBatches}):`, (lastError as any).message);
      throw lastError;
    }

    // Throttle between batches to avoid socket overload
    if (i + batchSize < rows.length) await sleep(300);
  }
  if (totalBatches > 1) process.stdout.write("\n");
  return allResults;
}

// ---------------------------------------------------------------------------
// RESUMABILITY: check existing row counts
// ---------------------------------------------------------------------------
async function tableCount(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const startTime = Date.now();
  console.log("=== Edvera Canonical Schema Seed ===\n");

  // -----------------------------------------------------------------------
  // Check existing state for resumability
  // -----------------------------------------------------------------------
  console.log("Checking existing data for resume...");
  const counts = {
    districts: await tableCount("districts"),
    sis_connections: await tableCount("sis_connections"),
    schools: await tableCount("schools"),
    absence_code_maps: await tableCount("absence_code_maps"),
    school_calendars: await tableCount("school_calendars"),
    students: await tableCount("students"),
    enrollments: await tableCount("enrollments"),
    contacts: await tableCount("contacts"),
  };
  console.log("  Existing rows:", JSON.stringify(counts));

  // -----------------------------------------------------------------------
  // 1. District
  // -----------------------------------------------------------------------
  let districtId: string;
  if (counts.districts > 0) {
    const { data } = await supabase
      .from("districts")
      .select("id")
      .eq("name", "Pacific Unified School District")
      .limit(1)
      .single();
    districtId = data!.id;
    console.log(`1/12 District exists: ${districtId}`);
  } else {
    console.log("1/12 Creating district...");
    const [district] = await batchInsert("districts", [
      {
        name: "Pacific Unified School District",
        state: "CA",
        website_url: "https://www.pacificusd.org",
      },
    ]);
    districtId = district.id;
    console.log(`  District: ${districtId}`);
  }

  // -----------------------------------------------------------------------
  // 2. SIS Connection
  // -----------------------------------------------------------------------
  let sisConnectionId: string;
  if (counts.sis_connections > 0) {
    const { data } = await supabase
      .from("sis_connections")
      .select("id")
      .eq("district_id", districtId)
      .limit(1)
      .single();
    sisConnectionId = data!.id;
    console.log(`2/12 SIS connection exists: ${sisConnectionId}`);
  } else {
    console.log("2/12 Creating SIS connection...");
    const [sisConn] = await batchInsert("sis_connections", [
      {
        district_id: districtId,
        platform: "aeries",
        display_name: "Aeries - Pacific USD",
        base_url: "https://demo.aeries.net/aeries",
        auth_config: { certificate: "477abe9e7d27439681d62f4e0de1f5e1" },
        sync_enabled: true,
        sync_interval_minutes: 360,
        last_sync_at: new Date().toISOString(),
        last_sync_status: "completed",
        database_year: ACADEMIC_YEAR,
        school_codes: SCHOOLS.map((s) => s.sisCode),
      },
    ]);
    sisConnectionId = sisConn.id;
    console.log(`  SIS Connection: ${sisConnectionId}`);
  }

  // -----------------------------------------------------------------------
  // 3. Schools
  // -----------------------------------------------------------------------
  const schoolIds: Record<string, string> = {};
  const { data: existingSchools } = await supabase
    .from("schools")
    .select("id, sis_school_id")
    .eq("district_id", districtId)
    .in("sis_school_id", SCHOOLS.map((s) => s.sisCode));

  if (existingSchools && existingSchools.length === SCHOOLS.length) {
    for (const s of existingSchools) {
      schoolIds[s.sis_school_id] = s.id;
    }
    console.log(`3/12 Schools exist (${existingSchools.length})`);
  } else {
    console.log("3/12 Creating schools...");
    for (const sc of SCHOOLS) {
      const [school] = await batchInsert("schools", [
        {
          name: sc.name,
          district_id: districtId,
          cds_code: sc.cdsCode,
          sis_school_id: sc.sisCode,
          sis_connection_id: sisConnectionId,
          address_street: sc.address,
          address_city: "Pacific Beach",
          address_state: "CA",
          address_zip: "90210",
          phone: sc.phone,
          principal_name: sc.principal,
          grade_low: sc.gradeLow,
          grade_high: sc.gradeHigh,
          school_type: sc.schoolType,
        },
      ]);
      schoolIds[sc.sisCode] = school.id;
      console.log(`  ${sc.name}: ${school.id}`);
    }
  }

  // -----------------------------------------------------------------------
  // 4. Absence Code Maps
  // -----------------------------------------------------------------------
  const absenceCodeIdMap = new Map<string, string>();
  const absenceCodeInfoMap = new Map<string, (typeof ABSENCE_CODES)[number]>();

  // Always populate the info map (needed for attendance generation)
  for (const c of ABSENCE_CODES) {
    absenceCodeInfoMap.set(c.sis_code, c);
  }

  if (counts.absence_code_maps > 0) {
    const { data: existingCodes } = await supabase
      .from("absence_code_maps")
      .select("id, sis_code")
      .eq("sis_connection_id", sisConnectionId);
    for (const c of existingCodes || []) {
      absenceCodeIdMap.set(c.sis_code, c.id);
    }
    console.log(`4/12 Absence codes exist (${absenceCodeIdMap.size})`);
  } else {
    console.log("4/12 Creating absence code maps...");
    const absenceCodeRows = ABSENCE_CODES.map((c) => ({
      sis_connection_id: sisConnectionId,
      ...c,
    }));
    const absenceCodeResults = await batchInsert("absence_code_maps", absenceCodeRows);
    for (let i = 0; i < ABSENCE_CODES.length; i++) {
      absenceCodeIdMap.set(ABSENCE_CODES[i].sis_code, absenceCodeResults[i].id);
    }
    console.log(`  ${absenceCodeResults.length} absence codes created`);
  }

  // -----------------------------------------------------------------------
  // 5. School Calendar
  // -----------------------------------------------------------------------
  const calendar = generateCalendar();
  const schoolDays = calendar
    .filter((d) => d.is_school_day)
    .map((d) => d.calendar_date);

  if (counts.school_calendars > 0) {
    console.log(`5/12 School calendars exist (${counts.school_calendars} rows, ${schoolDays.length} instructional days)`);
  } else {
    console.log("5/12 Generating school calendars...");
    console.log(`  ${calendar.length} calendar days, ${schoolDays.length} instructional days`);
    const calendarRows: Record<string, unknown>[] = [];
    for (const sc of SCHOOLS) {
      const sid = schoolIds[sc.sisCode];
      for (const day of calendar) {
        calendarRows.push({
          school_id: sid,
          academic_year: ACADEMIC_YEAR,
          calendar_date: day.calendar_date,
          is_school_day: day.is_school_day,
          day_type: day.day_type,
          attendance_month: day.attendance_month,
          notes: day.notes,
          last_synced_at: new Date().toISOString(),
        });
      }
    }
    await batchInsert("school_calendars", calendarRows);
    console.log(`  ${calendarRows.length} calendar rows inserted`);
  }

  // -----------------------------------------------------------------------
  // Expected total students based on config
  // -----------------------------------------------------------------------
  const expectedStudentCount = SCHOOLS.reduce((sum, s) => sum + s.studentCount, 0);
  const needsStudentReseed = counts.students !== expectedStudentCount;

  // -----------------------------------------------------------------------
  // Clean up steps 6-12 if student count doesn't match expected
  // -----------------------------------------------------------------------
  if (needsStudentReseed && (counts.students > 0 || counts.enrollments > 0 || counts.contacts > 0)) {
    console.log(`Student count mismatch (have ${counts.students}, need ${expectedStudentCount}). Cleaning up...`);
    const cleanupTables = [
      "intervention_log",
      "compliance_cases",
      "funding_projections",
      "risk_signals",
      "attendance_snapshots",
      "attendance_daily",
      "contacts",
      "enrollments",
      "students",
    ];
    for (const table of cleanupTables) {
      const { error } = await supabase.from(table).delete().gte("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.error(`  Warning: failed to delete from ${table}: ${error.message}`);
      } else {
        console.log(`  Deleted rows from ${table}`);
      }
    }
    await supabase.from("sis_sync_log").delete().gte("id", "00000000-0000-0000-0000-000000000000");
    console.log("  Cleanup complete\n");
    // Reset counts after cleanup
    counts.students = 0;
    counts.enrollments = 0;
    counts.contacts = 0;
  }

  // -----------------------------------------------------------------------
  // 6. Students
  // -----------------------------------------------------------------------
  const allStudents: {
    schoolConfig: SchoolConfig;
    record: StudentRecord;
    dbId?: string;
  }[] = [];

  for (const sc of SCHOOLS) {
    const students = generateStudents(sc);
    for (const s of students) {
      allStudents.push({ schoolConfig: sc, record: s });
    }
  }

  if (counts.students > 0) {
    console.log(`6/12 Students exist (${counts.students}), loading IDs...`);
    for (const sc of SCHOOLS) {
      const schoolStudents = allStudents.filter(
        (s) => s.schoolConfig.sisCode === sc.sisCode
      );
      const sisIds = schoolStudents.map((s) => s.record.sis_student_id);
      for (let i = 0; i < sisIds.length; i += 500) {
        const batch = sisIds.slice(i, i + 500);
        const { data } = await supabase
          .from("students")
          .select("id, sis_student_id")
          .eq("district_id", districtId)
          .in("sis_student_id", batch);
        if (data) {
          const lookup = new Map(data.map((d) => [d.sis_student_id, d.id]));
          for (const s of schoolStudents) {
            const dbId = lookup.get(s.record.sis_student_id);
            if (dbId) s.dbId = dbId;
          }
        }
      }
    }
    console.log(`  Loaded ${allStudents.filter((s) => s.dbId).length} student IDs`);
  } else {
    console.log("6/12 Inserting students...");
    const studentRows = allStudents.map((s) => ({
      school_id: schoolIds[s.schoolConfig.sisCode],
      district_id: districtId,
      sis_student_id: s.record.sis_student_id,
      state_student_id: s.record.state_student_id,
      student_number: s.record.student_number,
      last_name: s.record.last_name,
      first_name: s.record.first_name,
      middle_name: s.record.middle_name,
      gender: s.record.gender,
      birth_date: s.record.birth_date,
      grade_level: s.record.grade_level,
      ethnicity_code: s.record.ethnicity_code,
      race_codes: s.record.race_codes,
      home_language_code: s.record.home_language_code,
      language_fluency: s.record.language_fluency,
      correspondence_language: s.record.correspondence_language,
      address_street: s.record.address_street,
      address_city: s.record.address_city,
      address_state: s.record.address_state,
      address_zip: s.record.address_zip,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    }));
    const studentResults = await batchInsert("students", studentRows);
    for (let i = 0; i < allStudents.length; i++) {
      allStudents[i].dbId = studentResults[i].id;
    }
    console.log(`  ${studentResults.length} students inserted`);
  }

  // -----------------------------------------------------------------------
  // 7. Enrollments
  // -----------------------------------------------------------------------
  const enrollmentCount = await tableCount("enrollments");
  if (enrollmentCount > 0) {
    console.log(`7/12 Enrollments exist (${enrollmentCount})`);
  } else {
    console.log("7/12 Creating enrollments...");
    const enrollmentRows = allStudents.map((s) => ({
      student_id: s.dbId,
      school_id: schoolIds[s.schoolConfig.sisCode],
      academic_year: ACADEMIC_YEAR,
      grade_level: s.record.grade_level,
      enter_date: dateStr(YEAR_START),
      leave_date: null,
      attendance_program_code: "1",
      last_synced_at: new Date().toISOString(),
    }));
    await batchInsert("enrollments", enrollmentRows);
    console.log(`  ${enrollmentRows.length} enrollments inserted`);
  }

  // -----------------------------------------------------------------------
  // 8. Contacts — generate (drives PRNG) and conditionally insert
  // -----------------------------------------------------------------------
  const allContactRows: Record<string, unknown>[] = [];
  for (const s of allStudents) {
    const contacts = generateContacts(s.record);
    for (const c of contacts) {
      allContactRows.push({
        student_id: s.dbId,
        ...c,
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  const contactCountNow = await tableCount("contacts");
  if (contactCountNow > 0) {
    console.log(`8/12 Contacts exist (${contactCountNow})`);
  } else {
    console.log("8/12 Creating contacts...");
    await batchInsert("contacts", allContactRows);
    console.log(`  ${allContactRows.length} contacts inserted`);
  }

  // -----------------------------------------------------------------------
  // 9. Attendance Daily
  // -----------------------------------------------------------------------
  console.log("9/12 Generating attendance data in memory...");
  const studentAttendance: Map<string, AttendanceDayRecord[]> = new Map();

  for (const s of allStudents) {
    const att = generateAttendance(
      s.record,
      schoolDays,
      s.schoolConfig.absenceMultiplier,
      absenceCodeInfoMap
    );
    studentAttendance.set(s.dbId!, att);
  }
  console.log(`  Generated attendance for ${allStudents.length} students`);

  const attCount = await tableCount("attendance_daily");
  const expectedAttRows = allStudents.length * schoolDays.length;
  if (attCount > 0 && attCount >= expectedAttRows * 0.9) {
    console.log(`  attendance_daily already has ${attCount} rows, skipping insert`);
  } else {
    if (attCount > 0) {
      console.log(`  attendance_daily has ${attCount}/${expectedAttRows} rows (incomplete), cleaning up...`);
      await supabase.from("attendance_daily").delete().gte("id", "00000000-0000-0000-0000-000000000000");
      // Also clean downstream tables that depend on attendance data
      for (const t of ["intervention_log", "compliance_cases", "funding_projections", "risk_signals", "attendance_snapshots"]) {
        await supabase.from(t).delete().gte("id", "00000000-0000-0000-0000-000000000000");
      }
      await supabase.from("sis_sync_log").delete().gte("id", "00000000-0000-0000-0000-000000000000");
    }
    console.log("  Inserting attendance_daily...");
    const attendanceRows: Record<string, unknown>[] = [];
    for (const s of allStudents) {
      const att = studentAttendance.get(s.dbId!)!;
      for (const rec of att) {
        attendanceRows.push({
          student_id: s.dbId,
          school_id: schoolIds[s.schoolConfig.sisCode],
          calendar_date: rec.calendar_date,
          sis_absence_code: rec.sis_absence_code,
          absence_code_map_id: rec.sis_absence_code
            ? absenceCodeIdMap.get(rec.sis_absence_code) || null
            : null,
          canonical_type: rec.canonical_type,
          counts_for_ada: rec.counts_for_ada,
          counts_as_truancy: rec.counts_as_truancy,
          has_period_detail: false,
          last_synced_at: new Date().toISOString(),
        });
      }
    }
    console.log(`  ${attendanceRows.length} rows to insert`);
    await batchInsert("attendance_daily", attendanceRows);
    console.log(`  attendance_daily complete`);
  }

  // -----------------------------------------------------------------------
  // 10. Attendance Snapshots
  // -----------------------------------------------------------------------
  const snapCount = await tableCount("attendance_snapshots");
  if (snapCount > 0) {
    console.log(`10/12 Attendance snapshots exist (${snapCount})`);
  } else {
    console.log("10/12 Computing attendance snapshots...");
    const snapshotRows: Record<string, unknown>[] = [];
    for (const s of allStudents) {
      const att = studentAttendance.get(s.dbId!)!;
      const snap = computeSnapshot(att);
      snapshotRows.push({
        student_id: s.dbId,
        school_id: schoolIds[s.schoolConfig.sisCode],
        academic_year: ACADEMIC_YEAR,
        ...snap,
        snapshot_date: dateStr(new Date()),
      });
    }
    await batchInsert("attendance_snapshots", snapshotRows);
    console.log(`  ${snapshotRows.length} snapshots inserted`);
  }

  // -----------------------------------------------------------------------
  // 11. Risk Signals
  // -----------------------------------------------------------------------
  const sigCount = await tableCount("risk_signals");
  if (sigCount > 0) {
    console.log(`11/12 Risk signals exist (${sigCount})`);
  } else {
    console.log("11/12 Computing risk signals...");
    const signalRows: Record<string, unknown>[] = [];
    for (const s of allStudents) {
      const att = studentAttendance.get(s.dbId!)!;
      const sig = computeRiskSignal(att);
      signalRows.push({
        student_id: s.dbId,
        school_id: schoolIds[s.schoolConfig.sisCode],
        ...sig,
      });
    }
    await batchInsert("risk_signals", signalRows);

    const signalCounts = { pending: 0, stable: 0, softening: 0, elevated: 0 };
    for (const s of signalRows) {
      signalCounts[s.signal_level as keyof typeof signalCounts]++;
    }
    console.log(
      `  Signals: stable=${signalCounts.stable} softening=${signalCounts.softening} elevated=${signalCounts.elevated} pending=${signalCounts.pending}`
    );
  }

  // -----------------------------------------------------------------------
  // 12. Funding Projections + Compliance Cases + Intervention Log
  // -----------------------------------------------------------------------
  const fundCount = await tableCount("funding_projections");
  const compCount = await tableCount("compliance_cases");
  if (fundCount > 0 && compCount > 0) {
    console.log(`12/12 Funding (${fundCount}) and compliance (${compCount}) exist`);
  } else {
    console.log("12/12 Computing funding projections and compliance cases...");

    const fundingStudentRows: Record<string, unknown>[] = [];
    const complianceCaseRows: Record<string, unknown>[] = [];
    const interventionRows: Record<string, unknown>[] = [];

    const schoolAgg: Record<
      string,
      { totalStudents: number; chronicCount: number; totalLoss: number }
    > = {};
    for (const sc of SCHOOLS) {
      schoolAgg[sc.sisCode] = { totalStudents: 0, chronicCount: 0, totalLoss: 0 };
    }

    for (const s of allStudents) {
      const att = studentAttendance.get(s.dbId!)!;
      const snap = computeSnapshot(att);
      const schoolSis = s.schoolConfig.sisCode;

      const daysRemaining = TOTAL_INSTRUCTIONAL_DAYS - att.length;
      const currentAbsentRate =
        att.length > 0 ? snap.days_absent / att.length : 0;
      const projectedAbsentDays = Math.round(
        snap.days_absent + currentAbsentRate * daysRemaining
      );
      const projectedAdaLoss = projectedAbsentDays * PER_PUPIL_DAILY_RATE;

      fundingStudentRows.push({
        student_id: s.dbId,
        school_id: schoolIds[schoolSis],
        academic_year: ACADEMIC_YEAR,
        per_pupil_daily_rate: PER_PUPIL_DAILY_RATE,
        projected_absent_days: projectedAbsentDays,
        projected_ada_loss: projectedAdaLoss,
      });

      schoolAgg[schoolSis].totalStudents++;
      if (snap.is_chronic_absent) schoolAgg[schoolSis].chronicCount++;
      schoolAgg[schoolSis].totalLoss += projectedAdaLoss;

      // Compliance cases
      let unexcusedCount = 0;
      let truancyCount = 0;
      let totalAbsences = 0;
      for (const r of att) {
        if (
          r.canonical_type === "absent_unexcused" ||
          r.canonical_type === "absent_unverified"
        ) {
          unexcusedCount++;
        }
        if (r.counts_as_truancy) truancyCount++;
        if (
          r.canonical_type !== "present" &&
          r.canonical_type !== "tardy" &&
          r.canonical_type !== "tardy_excused" &&
          r.canonical_type !== "tardy_unexcused" &&
          r.canonical_type !== "suspension_in_school" &&
          r.canonical_type !== "independent_study_complete" &&
          r.canonical_type !== "not_enrolled"
        ) {
          totalAbsences++;
        }
      }

      if (unexcusedCount >= 3) {
        const tier1Date = "2025-10-15T00:00:00Z";
        const tier2Date = "2025-12-01T00:00:00Z";
        const tier3Date = "2026-02-15T00:00:00Z";

        const caseRow: Record<string, unknown> = {
          student_id: s.dbId,
          school_id: schoolIds[schoolSis],
          academic_year: ACADEMIC_YEAR,
          unexcused_absence_count: unexcusedCount,
          truancy_count: truancyCount,
          total_absence_count: totalAbsences,
          is_resolved: false,
        };

        if (unexcusedCount >= 10 || (att.length > 0 && totalAbsences / att.length >= 0.2)) {
          caseRow.current_tier = "tier_3_sarb_referral";
          caseRow.tier_1_triggered_at = tier1Date;
          caseRow.tier_1_letter_sent_at = "2025-10-20T00:00:00Z";
          caseRow.tier_2_triggered_at = tier2Date;
          caseRow.tier_2_conference_date = "2025-12-10";
          caseRow.tier_3_triggered_at = tier3Date;
          caseRow.tier_3_referral_date = "2026-03-01";
        } else if (unexcusedCount >= 5) {
          caseRow.current_tier = "tier_2_conference";
          caseRow.tier_1_triggered_at = tier1Date;
          caseRow.tier_1_letter_sent_at = "2025-10-20T00:00:00Z";
          caseRow.tier_2_triggered_at = tier2Date;
          caseRow.tier_2_conference_date = "2025-12-10";
        } else {
          caseRow.current_tier = "tier_1_letter";
          caseRow.tier_1_triggered_at = tier1Date;
          caseRow.tier_1_letter_sent_at = "2025-10-20T00:00:00Z";
        }

        complianceCaseRows.push(caseRow);
      }
    }

    const fundingSchoolRows: Record<string, unknown>[] = [];
    for (const sc of SCHOOLS) {
      const agg = schoolAgg[sc.sisCode];
      fundingSchoolRows.push({
        student_id: null,
        school_id: schoolIds[sc.sisCode],
        academic_year: ACADEMIC_YEAR,
        per_pupil_daily_rate: PER_PUPIL_DAILY_RATE,
        total_students: agg.totalStudents,
        total_chronic_absent: agg.chronicCount,
        total_projected_loss: Math.round(agg.totalLoss * 100) / 100,
      });
    }
    await batchInsert("funding_projections", [...fundingStudentRows, ...fundingSchoolRows]);
    console.log(`  ${fundingStudentRows.length} student + ${fundingSchoolRows.length} school funding projections`);

    if (complianceCaseRows.length > 0) {
      const caseResults = await batchInsert("compliance_cases", complianceCaseRows);

      for (let i = 0; i < caseResults.length; i++) {
        const caseRow = complianceCaseRows[i];
        const caseId = caseResults[i].id;
        const tier = caseRow.current_tier as string;

        interventionRows.push({
          student_id: caseRow.student_id,
          school_id: caseRow.school_id,
          compliance_case_id: caseId,
          intervention_type: "letter",
          intervention_date: "2025-10-20",
          description: "First truancy notification letter sent to parent/guardian.",
          outcome: pick(["no_response", "parent_contacted", "no_response"]),
          performed_by_name: pick(["Office Staff", "Attendance Clerk", "Vice Principal"]),
        });

        if (tier === "tier_2_conference" || tier === "tier_3_sarb_referral") {
          interventionRows.push({
            student_id: caseRow.student_id,
            school_id: caseRow.school_id,
            compliance_case_id: caseId,
            intervention_type: "phone_call",
            intervention_date: "2025-11-15",
            description: "Phone call to parent/guardian regarding continued absences.",
            outcome: pick(["parent_contacted", "no_response", "meeting_scheduled"]),
            performed_by_name: pick(["Counselor", "Vice Principal", "Social Worker"]),
          });
          interventionRows.push({
            student_id: caseRow.student_id,
            school_id: caseRow.school_id,
            compliance_case_id: caseId,
            intervention_type: "conference",
            intervention_date: "2025-12-10",
            description: "Parent-teacher conference regarding attendance improvement plan.",
            outcome: pick(["meeting_scheduled", "attendance_improved", "no_response"]),
            performed_by_name: pick(["Principal", "Vice Principal", "Counselor"]),
          });
        }

        if (tier === "tier_3_sarb_referral") {
          interventionRows.push({
            student_id: caseRow.student_id,
            school_id: caseRow.school_id,
            compliance_case_id: caseId,
            intervention_type: "home_visit",
            intervention_date: "2026-01-20",
            description: "Home visit to assess barriers to attendance.",
            outcome: pick(["parent_contacted", "no_response"]),
            performed_by_name: pick(["Social Worker", "Attendance Specialist"]),
          });
          interventionRows.push({
            student_id: caseRow.student_id,
            school_id: caseRow.school_id,
            compliance_case_id: caseId,
            intervention_type: "sarb_referral",
            intervention_date: "2026-03-01",
            description: "Referred to School Attendance Review Board (SARB).",
            outcome: "meeting_scheduled",
            performed_by_name: "District SARB Coordinator",
          });
        }
      }

      if (interventionRows.length > 0) {
        await batchInsert("intervention_log", interventionRows);
      }
      console.log(
        `  ${complianceCaseRows.length} compliance cases, ${interventionRows.length} interventions`
      );
    }
  }

  // -----------------------------------------------------------------------
  // SIS Sync Log
  // -----------------------------------------------------------------------
  const syncCount = await tableCount("sis_sync_log");
  if (syncCount > 0) {
    console.log(`SIS sync log exists (${syncCount})`);
  } else {
    await batchInsert("sis_sync_log", [
      {
        sis_connection_id: sisConnectionId,
        started_at: new Date(Date.now() - 45000).toISOString(),
        completed_at: new Date().toISOString(),
        status: "completed",
        sync_type: "full",
        school_codes_synced: SCHOOLS.map((s) => s.sisCode),
        rows_fetched: allStudents.length * schoolDays.length,
        rows_created: allStudents.length * schoolDays.length,
        rows_updated: 0,
        rows_errored: 0,
        duration_ms: 45000,
      },
    ]);
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Seed complete in ${elapsed}s ===`);
  console.log(`  Students: ${allStudents.length}`);

  const demoCounts = { hispanic: 0, white: 0, asian: 0, black: 0, other: 0 };
  const elCount = allStudents.filter((s) => s.record.language_fluency === "EL").length;
  for (const s of allStudents) {
    demoCounts[s.record._ethnicity as keyof typeof demoCounts]++;
  }
  const total = allStudents.length;
  console.log(`\n  Demographics:`);
  console.log(`    Hispanic: ${demoCounts.hispanic} (${((demoCounts.hispanic / total) * 100).toFixed(1)}%)`);
  console.log(`    White: ${demoCounts.white} (${((demoCounts.white / total) * 100).toFixed(1)}%)`);
  console.log(`    Asian: ${demoCounts.asian} (${((demoCounts.asian / total) * 100).toFixed(1)}%)`);
  console.log(`    Black: ${demoCounts.black} (${((demoCounts.black / total) * 100).toFixed(1)}%)`);
  console.log(`    Other: ${demoCounts.other} (${((demoCounts.other / total) * 100).toFixed(1)}%)`);
  console.log(`    English Learners: ${elCount} (${((elCount / total) * 100).toFixed(1)}%)`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
