import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getDistrictName } from "@/services/schools/getDistrictName";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SchoolFunding {
  school_name: string;
  total_students: number;
  total_chronic_absent: number;
  total_projected_loss: number;
  chronic_rate: number;
}

interface ChronicSnapshot {
  days_absent: number;
  days_enrolled: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const TARGET_OPTIONS = [
  { value: 0.95, label: "95% (Satisfactory)" },
  { value: 0.92, label: "92% (Near satisfactory)" },
  { value: 0.90, label: "90% (Threshold)" },
];

const TEACHER_SALARY = 85_000;

export interface SimResult {
  totalChronic: number;
  avgAbsenceDays: number;
  avgDaysEnrolled: number;
  targetAbsenceDays: number;
  daysRecoveredPerStudent: number;
  revenuePerStudent: number;
  totalRecovery: number;
  recoveryPct: number;
  teacherEquiv: number;
  newChronicCount: number;
  newChronicRate: number;
  currentChronicRate: number;
  remainingLoss: number;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useFunding() {
  const [schools, setSchools] = useState<SchoolFunding[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLoss, setTotalLoss] = useState(0);

  // Simulator data
  const [chronicSnapshots, setChronicSnapshots] = useState<ChronicSnapshot[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);

  // Narrative / tooltip data
  const [remainingSchoolDays, setRemainingSchoolDays] = useState(0);
  const [totalAbsentDaysChronic, setTotalAbsentDaysChronic] = useState(0);
  const [totalProjectedDaysChronic, setTotalProjectedDaysChronic] = useState(0);
  const [districtName, setDistrictName] = useState("District");

  // Simulator controls
  const [sliderValue, setSliderValue] = useState(0);
  const [dailyRate, setDailyRate] = useState(65);
  const [targetRate, setTargetRate] = useState(0.95);

  useEffect(() => {
    fetchFunding();
  }, []);

  async function fetchFunding() {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [
        { data: fundingData },
        { data: snapshotData },
        { count },
        { data: calendarData },
        { data: studentFundingData },
        dName,
      ] = await Promise.all([
        supabase
          .from("funding_projections")
          .select(
            `school_id, total_students, total_chronic_absent, total_projected_loss,
             schools!funding_projections_school_id_fkey(name)`
          )
          .is("student_id", null),
        supabase
          .from("attendance_snapshots")
          .select("days_absent, days_enrolled")
          .eq("is_chronic_absent", true),
        supabase
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        // Calendar data for remaining school days
        supabase
          .from("school_calendars")
          .select("calendar_date")
          .eq("is_school_day", true)
          .gt("calendar_date", today),
        // Student-level funding projections for tooltip aggregate data
        supabase
          .from("funding_projections")
          .select("projected_absent_days, projected_ada_loss")
          .not("student_id", "is", null),
        getDistrictName().catch(() => "District"),
      ]);

      setDistrictName(dName);

      // Remaining school days = future school days across any school
      // (use distinct dates to avoid double-counting if multi-school)
      const futureDates = new Set(
        (calendarData ?? []).map((c: any) => c.calendar_date)
      );
      setRemainingSchoolDays(futureDates.size);

      // Aggregate student-level funding data for tooltip
      const studentFunding = studentFundingData ?? [];
      const sumProjectedDays = studentFunding.reduce(
        (s: number, r: any) => s + (r.projected_absent_days ?? 0),
        0
      );
      setTotalProjectedDaysChronic(sumProjectedDays);

      const rows: SchoolFunding[] = (fundingData ?? []).map((f: any) => ({
        school_name: f.schools?.name ?? "Unknown",
        total_students: f.total_students ?? 0,
        total_chronic_absent: f.total_chronic_absent ?? 0,
        total_projected_loss: Math.round(f.total_projected_loss ?? 0),
        chronic_rate:
          f.total_students > 0
            ? ((f.total_chronic_absent ?? 0) / f.total_students) * 100
            : 0,
      }));

      setSchools(rows);
      setTotalLoss(rows.reduce((sum, r) => sum + r.total_projected_loss, 0));
      setTotalStudents(count ?? 0);

      const snaps: ChronicSnapshot[] = (snapshotData ?? []).map((s: any) => ({
        days_absent: s.days_absent ?? 0,
        days_enrolled: s.days_enrolled ?? 0,
      }));
      setChronicSnapshots(snaps);

      // Sum of actual absent days across chronic students (for tooltip)
      const sumAbsent = snaps.reduce((s, c) => s + c.days_absent, 0);
      setTotalAbsentDaysChronic(sumAbsent);

      // Default slider to ~25% of chronic students
      if (snaps.length > 0) {
        setSliderValue(Math.round(snaps.length * 0.25));
      }
    } catch (err) {
      console.error("Failed to fetch funding data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ---- Simulator calculations ----
  const sim: SimResult = useMemo(() => {
    const totalChronic = chronicSnapshots.length;
    if (totalChronic === 0) {
      return {
        totalChronic: 0,
        avgAbsenceDays: 0,
        avgDaysEnrolled: 0,
        targetAbsenceDays: 0,
        daysRecoveredPerStudent: 0,
        revenuePerStudent: 0,
        totalRecovery: 0,
        recoveryPct: 0,
        teacherEquiv: 0,
        newChronicCount: 0,
        newChronicRate: 0,
        currentChronicRate: 0,
        remainingLoss: 0,
      };
    }

    const sumAbsent = chronicSnapshots.reduce((s, c) => s + c.days_absent, 0);
    const sumEnrolled = chronicSnapshots.reduce((s, c) => s + c.days_enrolled, 0);
    const avgAbsenceDays = sumAbsent / totalChronic;
    const avgDaysEnrolled = sumEnrolled / totalChronic;
    const targetAbsenceDays = avgDaysEnrolled * (1 - targetRate);
    const daysRecoveredPerStudent = Math.max(0, avgAbsenceDays - targetAbsenceDays);
    const revenuePerStudent = daysRecoveredPerStudent * dailyRate;
    const totalRecovery = Math.round(revenuePerStudent * sliderValue);
    const recoveryPct = totalLoss > 0 ? Math.min(100, (totalRecovery / totalLoss) * 100) : 0;
    const teacherEquiv = Math.round(totalRecovery / TEACHER_SALARY);
    const newChronicCount = totalChronic - sliderValue;
    const currentChronicRate = totalStudents > 0 ? (totalChronic / totalStudents) * 100 : 0;
    const newChronicRate = totalStudents > 0 ? (newChronicCount / totalStudents) * 100 : 0;
    const remainingLoss = Math.max(0, totalLoss - totalRecovery);

    return {
      totalChronic,
      avgAbsenceDays,
      avgDaysEnrolled,
      targetAbsenceDays,
      daysRecoveredPerStudent,
      revenuePerStudent,
      totalRecovery,
      recoveryPct,
      teacherEquiv,
      newChronicCount,
      newChronicRate,
      currentChronicRate,
      remainingLoss,
    };
  }, [chronicSnapshots, sliderValue, dailyRate, targetRate, totalLoss, totalStudents]);

  return {
    loading,
    schools,
    totalLoss,
    sim,
    sliderValue,
    setSliderValue,
    dailyRate,
    setDailyRate,
    targetRate,
    setTargetRate,
    remainingSchoolDays,
    districtName,
    totalAbsentDaysChronic,
    totalProjectedDaysChronic,
  };
}
