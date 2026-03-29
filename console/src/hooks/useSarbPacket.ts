import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  generateInterventionLogPDF,
  type InterventionLogInput,
  type InterventionLogEntry,
} from "@/lib/documents/interventions-log";
import { generateSARBPacket } from "@/services/documents/generateSarbPacket";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export interface CaseDetailForModal {
  id: string;
  student_id: string;
  school_id: string;
  district_id: string;
  academic_year: string;
  current_tier: string;
  tier_requirements: Record<string, unknown>;
  root_cause_data: Record<string, unknown>;
  sarb_packet_status: string;
  unexcused_absence_count: number;
  truancy_count: number;
  total_absence_count: number;
  created_at: string;
  student_name: string;
  student_first_name: string;
  student_last_name: string;
  student_grade: string;
  student_dob: string | null;
  school_name: string;
}

export interface Attendee {
  id: string;
  name: string;
  role: string;
  title: string;
}

export interface PacketComponent {
  key: string;
  label: string;
  required: boolean;
  status: "not_started" | "generated" | "uploaded";
  generatedAt?: string;
}

export const SARB_STEPS = [
  { num: 1, label: "Student Info" },
  { num: 2, label: "Narrative" },
  { num: 3, label: "Documents" },
  { num: 4, label: "Attendees" },
  { num: 5, label: "Review" },
];

export const ATTENDEE_ROLES = [
  "Principal",
  "Vice Principal",
  "Counselor",
  "Teacher",
  "Parent/Guardian",
  "Social Worker",
  "School Psychologist",
  "Attendance Clerk",
  "Other",
];

const INITIAL_COMPONENTS: PacketComponent[] = [
  { key: "attendance_record", label: "Attendance Record", required: true, status: "not_started" },
  { key: "truancy_notifications", label: "Truancy Notification Letters", required: true, status: "not_started" },
  { key: "conference_summaries", label: "Conference Summary", required: true, status: "not_started" },
  { key: "interventions_log", label: "SART Interventions Log", required: true, status: "not_started" },
  { key: "root_cause_worksheet", label: "Root Cause Worksheet", required: true, status: "not_started" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useSarbPacket(
  caseDetail: CaseDetailForModal,
  onSaved: () => void
) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [packetId, setPacketId] = useState<string | null>(null);

  // Step 1 state
  const [ssid, setSsid] = useState("");
  const [referralType, setReferralType] = useState("initial");
  const [specialEdNotes, setSpecialEdNotes] = useState("");

  // Step 2 state
  const [narrative, setNarrative] = useState("");
  const [generatingNarrative, setGeneratingNarrative] = useState(false);

  // Step 3 state
  const [components, setComponents] = useState<PacketComponent[]>(INITIAL_COMPONENTS);
  const [generatingDocKey, setGeneratingDocKey] = useState<string | null>(null);

  // Step 4 state
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  /* ---- Load existing data on mount ---- */
  useEffect(() => {
    loadExistingPacket();
    loadSsid();
  }, []);

  async function loadExistingPacket() {
    const { data } = await supabase
      .from("sarb_packets")
      .select("*")
      .eq("compliance_case_id", caseDetail.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setPacketId(data.id);
      if (data.narrative_summary) setNarrative(data.narrative_summary);
      if (data.referral_type) setReferralType(data.referral_type);
      if (data.special_ed_notes) setSpecialEdNotes(data.special_ed_notes);
      if (data.attendees && Array.isArray(data.attendees) && data.attendees.length > 0) {
        setAttendees(data.attendees as Attendee[]);
      }
      if (data.packet_components) {
        const saved = data.packet_components as Record<string, { status: string; generatedAt?: string }>;
        setComponents(
          INITIAL_COMPONENTS.map((c) => ({
            ...c,
            status: (saved[c.key]?.status as PacketComponent["status"]) ?? "not_started",
            generatedAt: saved[c.key]?.generatedAt,
          }))
        );
      }
    }
  }

  async function loadSsid() {
    const { data } = await supabase
      .from("students")
      .select("ssid")
      .eq("id", caseDetail.student_id)
      .single();
    if (data?.ssid) setSsid(data.ssid);
  }

  /* ---- Narrative generation ---- */
  const generateNarrative = useCallback(async () => {
    setGeneratingNarrative(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-sarb-narrative", {
        body: {
          compliance_case_id: caseDetail.id,
          student_id: caseDetail.student_id,
        },
      });

      if (error) {
        console.error("Failed to generate narrative:", error);
      } else if (data?.narrative) {
        setNarrative(data.narrative);
      }
    } catch (err) {
      console.error("Error calling generate-sarb-narrative:", err);
    } finally {
      setGeneratingNarrative(false);
    }
  }, [caseDetail.id, caseDetail.student_id]);

  /* ---- Document generation (Step 3) ---- */
  const generateInterventionsLog = useCallback(async () => {
    setGeneratingDocKey("interventions_log");
    try {
      const [{ data: actData }, { data: ivData }] = await Promise.all([
        supabase
          .from("actions")
          .select("action_type, title, completed_at, completion_notes, completion_data")
          .eq("compliance_case_id", caseDetail.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: true }),
        supabase
          .from("intervention_log")
          .select("intervention_type, intervention_date, description, outcome, performed_by_name")
          .eq("compliance_case_id", caseDetail.id)
          .order("intervention_date", { ascending: true }),
      ]);

      const entries: InterventionLogEntry[] = [];

      for (const a of actData ?? []) {
        entries.push({
          date: a.completed_at ? (a.completed_at as string).slice(0, 10) : "",
          type: (a.action_type as string).replace(/_/g, " "),
          description: a.title as string,
          staffMember: "",
          parentResponse: (a.completion_notes as string) ?? "",
        });
      }

      for (const iv of ivData ?? []) {
        entries.push({
          date: iv.intervention_date,
          type: (iv.intervention_type as string).replace(/_/g, " "),
          description: iv.description ?? "",
          staffMember: iv.performed_by_name ?? "",
          parentResponse: iv.outcome ?? "",
        });
      }

      entries.sort((a, b) => a.date.localeCompare(b.date));

      const input: InterventionLogInput = {
        student: {
          firstName: caseDetail.student_first_name,
          lastName: caseDetail.student_last_name,
          grade: caseDetail.student_grade,
        },
        school: { name: caseDetail.school_name },
        district: { name: "" },
        caseCreatedAt: caseDetail.created_at,
        entries,
        preparedBy: "",
        date: new Date().toISOString().slice(0, 10),
      };

      const blob = generateInterventionLogPDF(input);
      downloadBlob(
        blob,
        `Interventions-Log-${caseDetail.student_first_name}-${caseDetail.student_last_name}.pdf`
      );

      setComponents((prev) =>
        prev.map((c) =>
          c.key === "interventions_log"
            ? { ...c, status: "generated", generatedAt: new Date().toISOString() }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to generate interventions log:", err);
    } finally {
      setGeneratingDocKey(null);
    }
  }, [caseDetail]);

  const generateSarbPacketDoc = useCallback(async () => {
    setGeneratingDocKey("attendance_record");
    try {
      const blob = await generateSARBPacket(caseDetail.id);
      downloadBlob(
        blob,
        `SARB-Packet-${caseDetail.student_first_name}-${caseDetail.student_last_name}.pdf`
      );
      setComponents((prev) =>
        prev.map((c) =>
          c.key === "attendance_record"
            ? { ...c, status: "generated", generatedAt: new Date().toISOString() }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to generate:", err);
    } finally {
      setGeneratingDocKey(null);
    }
  }, [caseDetail]);

  const markComponentReady = useCallback((key: string) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.key === key
          ? { ...c, status: "uploaded", generatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  /* ---- Save / submit ---- */
  const savePacket = useCallback(
    async (markStatus: "draft" | "ready" | "submitted" = "draft") => {
      setSaving(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id ?? null;

        const packetComponents: Record<string, { status: string; generatedAt?: string }> = {};
        for (const c of components) {
          packetComponents[c.key] = { status: c.status, generatedAt: c.generatedAt };
        }

        if (ssid.trim()) {
          await supabase
            .from("students")
            .update({ ssid: ssid.trim() })
            .eq("id", caseDetail.student_id);
        }

        const packetData = {
          compliance_case_id: caseDetail.id,
          student_id: caseDetail.student_id,
          district_id: caseDetail.district_id,
          school_id: caseDetail.school_id,
          referral_type: referralType,
          narrative_summary: narrative || null,
          narrative_last_edited_by: userId,
          attendees: attendees.filter((a) => a.name.trim()),
          special_ed_notes: specialEdNotes || null,
          packet_components: packetComponents,
          assembled_by: userId,
          assembled_at: markStatus === "ready" || markStatus === "submitted" ? new Date().toISOString() : null,
          submitted_at: markStatus === "submitted" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        };

        if (packetId) {
          await supabase
            .from("sarb_packets")
            .update(packetData)
            .eq("id", packetId);
        } else {
          const { data: newPacket } = await supabase
            .from("sarb_packets")
            .insert(packetData)
            .select("id")
            .single();
          if (newPacket) setPacketId(newPacket.id);
        }

        const statusUpdate: Record<string, unknown> = {
          sarb_packet_status: markStatus,
        };
        if (markStatus === "ready" || markStatus === "submitted") {
          statusUpdate.sarb_packet_assembled_at = new Date().toISOString();
        }
        if (markStatus === "submitted") {
          statusUpdate.sarb_submitted_at = new Date().toISOString();
        }

        await supabase
          .from("compliance_cases")
          .update(statusUpdate)
          .eq("id", caseDetail.id);

        if (markStatus === "submitted" || markStatus === "ready") {
          onSaved();
        }
      } catch (err) {
        console.error("Failed to save packet:", err);
      } finally {
        setSaving(false);
      }
    },
    [caseDetail, packetId, ssid, referralType, narrative, attendees, specialEdNotes, components, onSaved]
  );

  const downloadFullPacket = useCallback(async () => {
    try {
      const blob = await generateSARBPacket(caseDetail.id);
      downloadBlob(
        blob,
        `SARB-Packet-${caseDetail.student_first_name}-${caseDetail.student_last_name}-${new Date().toISOString().slice(0, 10)}.pdf`
      );
    } catch (err) {
      console.error("Failed to download packet:", err);
    }
  }, [caseDetail]);

  /* ---- Computed ---- */
  const requiredComplete = components.filter((c) => c.required).every((c) => c.status !== "not_started");
  const hasNarrative = narrative.trim().length > 0;
  const canFinalize = requiredComplete && hasNarrative;

  return {
    step,
    setStep,
    saving,
    ssid,
    setSsid,
    referralType,
    setReferralType,
    specialEdNotes,
    setSpecialEdNotes,
    narrative,
    setNarrative,
    generatingNarrative,
    generateNarrative,
    components,
    setComponents,
    generatingDocKey,
    generateInterventionsLog,
    generateSarbPacketDoc,
    markComponentReady,
    attendees,
    setAttendees,
    savePacket,
    downloadFullPacket,
    canFinalize,
  };
}
