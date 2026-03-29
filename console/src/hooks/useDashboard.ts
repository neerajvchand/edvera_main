import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getDistrictName } from "@/services/schools/getDistrictName";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DashboardMetrics {
  districtName: string;
  totalStudents: number;
  chronicAbsenceRate: number;
  chronicAbsenceCount: number;
  projectedAdaLoss: number;
  elevatedStudents: number;
  softeningStudents: number;
  complianceCasesOpen: number;
  tier3Cases: number;
  tier1Cases: number;
  tier2Cases: number;
  monitoringCases: number;
  actionsOpen: number;
  actionsOverdue: number;
  advisoryCount: number;
  schoolBreakdown: {
    name: string;
    students: number;
    chronicRate: number;
    adaLoss: number;
    elevated: number;
  }[];
}

/* ------------------------------------------------------------------ */
/* Attendance band helper                                              */
/* ------------------------------------------------------------------ */

type Band = "satisfactory" | "at_risk" | "moderate" | "severe" | "acute";

export function getAbsenceBand(chronicRate: number): {
  band: Band;
  label: string;
  pillBg: string;
  pillText: string;
} {
  if (chronicRate < 6)
    return {
      band: "satisfactory",
      label: "Satisfactory",
      pillBg: "bg-emerald-50",
      pillText: "text-emerald-700",
    };
  if (chronicRate < 10)
    return {
      band: "at_risk",
      label: "At-Risk",
      pillBg: "bg-amber-50",
      pillText: "text-amber-700",
    };
  if (chronicRate < 20)
    return {
      band: "moderate",
      label: "Moderate Chronic",
      pillBg: "bg-orange-50",
      pillText: "text-orange-700",
    };
  if (chronicRate < 50)
    return {
      band: "severe",
      label: "Severe Chronic",
      pillBg: "bg-red-50",
      pillText: "text-red-700",
    };
  return {
    band: "acute",
    label: "Acute Chronic",
    pillBg: "bg-red-100",
    pillText: "text-red-900",
  };
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const advisoryTypes = [
        "improvement_detected",
        "stale_case",
        "plateau_detected",
        "monitoring_resolution",
      ];

      const [
        { count: totalStudents },
        { data: snapshots },
        { data: signals },
        { data: fundingSchool },
        { data: openCasesData },
        { data: openActions },
        { data: schools },
        districtName,
      ] = await Promise.all([
        supabase
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("attendance_snapshots")
          .select("student_id, school_id, attendance_rate, is_chronic_absent"),
        supabase
          .from("risk_signals")
          .select("student_id, school_id, signal_level"),
        supabase
          .from("funding_projections")
          .select(
            "school_id, total_students, total_chronic_absent, total_projected_loss"
          )
          .is("student_id", null),
        supabase
          .from("compliance_cases")
          .select("current_tier, case_workflow_stage")
          .eq("is_resolved", false),
        supabase
          .from("actions")
          .select("action_type, status, due_date")
          .eq("status", "open"),
        supabase.from("schools").select("id, name"),
        getDistrictName().catch(() => "District"),
      ]);

      // Compliance case breakdown
      const cases = openCasesData ?? [];
      const openCases = cases.length;
      const tier1Count = cases.filter((c) => c.current_tier === "tier_1_letter").length;
      const tier2Count = cases.filter((c) => c.current_tier === "tier_2_conference").length;
      const tier3Count = cases.filter((c) => c.current_tier === "tier_3_sarb_referral").length;
      const monitoringCount = cases.filter((c) => c.case_workflow_stage === "monitoring_period").length;

      // Action pipeline
      const actions = openActions ?? [];
      const actionsOpen = actions.length;
      const actionsOverdue = actions.filter((a) => a.due_date && a.due_date < today).length;
      const advisoryCount = actions.filter((a) => advisoryTypes.includes(a.action_type)).length;

      const schoolMap = new Map<string, string>();
      for (const s of schools ?? []) {
        schoolMap.set(s.id, s.name);
      }

      const chronicCount =
        snapshots?.filter((s) => s.is_chronic_absent).length ?? 0;
      const total = totalStudents ?? 0;
      const chronicRate = total > 0 ? (chronicCount / total) * 100 : 0;

      const elevated =
        signals?.filter((s) => s.signal_level === "elevated").length ?? 0;
      const softening =
        signals?.filter((s) => s.signal_level === "softening").length ?? 0;

      const totalAdaLoss =
        fundingSchool?.reduce(
          (sum, f) => sum + (f.total_projected_loss ?? 0),
          0
        ) ?? 0;

      const schoolBreakdown: DashboardMetrics["schoolBreakdown"] = [];
      for (const fs of fundingSchool ?? []) {
        const name = schoolMap.get(fs.school_id) ?? "Unknown";
        const schoolSignals =
          signals?.filter((s) => s.school_id === fs.school_id) ?? [];
        const schoolElevated = schoolSignals.filter(
          (s) => s.signal_level === "elevated"
        ).length;
        const schoolChronicRate =
          fs.total_students > 0
            ? ((fs.total_chronic_absent ?? 0) / fs.total_students) * 100
            : 0;

        schoolBreakdown.push({
          name,
          students: fs.total_students ?? 0,
          chronicRate: schoolChronicRate,
          adaLoss: Math.round(fs.total_projected_loss ?? 0),
          elevated: schoolElevated,
        });
      }

      setMetrics({
        districtName,
        totalStudents: total,
        chronicAbsenceRate: chronicRate,
        chronicAbsenceCount: chronicCount,
        projectedAdaLoss: Math.round(totalAdaLoss),
        elevatedStudents: elevated,
        softeningStudents: softening,
        complianceCasesOpen: openCases,
        tier3Cases: tier3Count,
        tier1Cases: tier1Count,
        tier2Cases: tier2Count,
        monitoringCases: monitoringCount,
        actionsOpen,
        actionsOverdue,
        advisoryCount,
        schoolBreakdown,
      });
    } catch (err) {
      console.error("Failed to fetch dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  return { metrics, loading };
}
