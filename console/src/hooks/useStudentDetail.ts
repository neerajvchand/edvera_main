import { useState, useEffect } from "react";
import { getStudentDetail } from "@/services/students/getStudentDetail";
import type {
  StudentBasic,
  Snapshot,
  RiskSignal,
  ComplianceCase,
  Action,
  AttendanceRecord,
  InterventionEntry,
} from "@/types/student";

/* ------------------------------------------------------------------ */
/* Re-export types so existing component imports keep working          */
/* ------------------------------------------------------------------ */

export type {
  StudentBasic,
  Snapshot,
  RiskSignal,
  ComplianceCase,
  Action,
  AttendanceRecord,
  InterventionEntry,
};

/* ------------------------------------------------------------------ */
/* Shared constants & helpers                                          */
/* ------------------------------------------------------------------ */

export const TIER_LABELS: Record<string, string> = {
  none: "None",
  tier_1_letter: "Tier 1 — Notification Letter",
  tier_2_conference: "Tier 2 — Conference",
  tier_3_sarb_referral: "Tier 3 — SARB Referral",
};

export const SHORT_TIER_LABELS: Record<string, string> = {
  none: "None",
  tier_1_letter: "Tier 1",
  tier_2_conference: "Tier 2",
  tier_3_sarb_referral: "Tier 3",
};

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useStudentDetail(studentId: string | undefined) {
  const [loading, setLoading] = useState(true);

  const [student, setStudent] = useState<StudentBasic | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [signal, setSignal] = useState<RiskSignal | null>(null);
  const [activeCase, setActiveCase] = useState<ComplianceCase | null>(null);
  const [allComplianceCases, setAllComplianceCases] = useState<ComplianceCase[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [absences, setAbsences] = useState<AttendanceRecord[]>([]);
  const [interventions, setInterventions] = useState<InterventionEntry[]>([]);
  const [allAttendance, setAllAttendance] = useState<{ calendar_date: string; canonical_type: string }[]>([]);

  useEffect(() => {
    if (!studentId) return;

    setLoading(true);
    getStudentDetail(studentId)
      .then((result) => {
        if (!result) return;
        setStudent(result.student);
        setSnapshot(result.snapshot);
        setSignal(result.signal);
        setActiveCase(result.activeCase);
        setAllComplianceCases(result.allComplianceCases);
        setActions(result.actions);
        setAbsences(result.absences);
        setInterventions(result.interventions);
        setAllAttendance(result.allAttendance);
      })
      .catch((err) => {
        console.error(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId]);

  return {
    headerLoading: loading,
    timelineLoading: loading,
    chartDataLoading: loading,
    student,
    snapshot,
    signal,
    activeCase,
    allComplianceCases,
    actions,
    absences,
    interventions,
    allAttendance,
  };
}
