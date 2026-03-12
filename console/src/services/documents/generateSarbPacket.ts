/**
 * SARB Packet generation service.
 *
 * Fetches all required data from the database and delegates to the
 * pure PDF builder in lib/documents/sarb-packet.ts.
 * This keeps the lib/ layer free of database calls.
 */
import { supabase } from "@/lib/supabase";
import { handleServiceError } from "@/services/serviceError";
import {
  generateSARBPacketFromData,
  type SarbPacketData,
  type MonthlyAttendance,
  type TimelineEntry,
  type InterventionEntry,
} from "@/lib/documents/sarb-packet";

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export async function generateSARBPacket(caseId: string): Promise<Blob> {
  try {
    // Fetch all data in parallel
    const [{ data: caseData }, { data: actData }, { data: ivData }] = await Promise.all([
      supabase
        .from("compliance_cases")
        .select(
          `*, students!compliance_cases_student_id_fkey(first_name, last_name, grade_level, date_of_birth, enrollment_date),
           schools!compliance_cases_school_id_fkey(name, address, phone, principal_name)`
        )
        .eq("id", caseId)
        .single(),
      supabase
        .from("actions")
        .select("id, action_type, title, status, due_date, completed_at, completion_data, completion_notes, created_at")
        .eq("compliance_case_id", caseId)
        .order("created_at", { ascending: true }),
      supabase
        .from("intervention_log")
        .select("id, intervention_type, intervention_date, description, outcome, performed_by_name")
        .eq("compliance_case_id", caseId)
        .order("intervention_date", { ascending: true }),
    ]);

    if (!caseData) throw new Error("Compliance case not found");

    const s = caseData.students as Record<string, string> | null;
    const sc = caseData.schools as Record<string, string> | null;

    // Fetch attendance snapshot
    const { data: snapData } = await supabase
      .from("attendance_snapshots")
      .select("days_enrolled, days_present, days_absent, days_absent_unexcused, attendance_rate, is_chronic_absent")
      .eq("student_id", caseData.student_id)
      .eq("academic_year", caseData.academic_year)
      .single();

    // Fetch monthly attendance from attendance_daily
    const { data: dailyData } = await supabase
      .from("attendance_daily")
      .select("attendance_date, status")
      .eq("student_id", caseData.student_id)
      .gte("attendance_date", `${caseData.academic_year.split("-")[0]}-07-01`)
      .lte("attendance_date", `${caseData.academic_year.split("-")[1]}-06-30`)
      .order("attendance_date", { ascending: true });

    // Build monthly breakdown
    const monthlyMap = new Map<string, { enrolled: number; absent: number; excused: number; unexcused: number }>();
    for (const row of dailyData ?? []) {
      const d = new Date(row.attendance_date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let entry = monthlyMap.get(key);
      if (!entry) {
        entry = { enrolled: 0, absent: 0, excused: 0, unexcused: 0 };
        monthlyMap.set(key, entry);
      }
      entry.enrolled++;
      const st = (row.status as string).toLowerCase();
      if (st.includes("absent")) {
        entry.absent++;
        if (st.includes("unexcused")) {
          entry.unexcused++;
        } else {
          entry.excused++;
        }
      }
    }

    const monthlyAttendance: MonthlyAttendance[] = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [yr, mo] = key.split("-");
        const monthName = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        return {
          month: monthName,
          daysEnrolled: val.enrolled,
          daysAbsent: val.absent,
          excused: val.excused,
          unexcused: val.unexcused,
          rate: val.enrolled > 0 ? Math.round(((val.enrolled - val.absent) / val.enrolled) * 1000) / 10 : 100,
        };
      });

    // Build timeline from actions
    const timeline: TimelineEntry[] = [];
    for (const a of actData ?? []) {
      if (a.status === "completed" && a.completed_at) {
        const cd = a.completion_data as Record<string, unknown> | null;
        let desc = `${a.title} — completed`;
        if (a.action_type === "send_letter" && cd?.method) {
          desc = `Tier 1 notification sent via ${(cd.method as string).replace(/_/g, " ")}`;
        } else if (a.action_type === "follow_up_call" && cd?.outcome) {
          desc = `Follow-up call — ${(cd.outcome as string).replace(/_/g, " ")}`;
        } else if (a.action_type === "schedule_conference" && cd?.status) {
          const attendees = (cd.attendees as string[]) ?? [];
          desc = `Tier 2 conference ${(cd.status as string).replace(/_/g, " ")}${attendees.length > 0 ? ` — ${attendees.join(", ")}` : ""}`;
          if (cd.resources && (cd.resources as string[]).length > 0) {
            timeline.push({
              date: a.completed_at.slice(0, 10),
              description: `Resources offered: ${(cd.resources as string[]).join(", ")}`,
            });
          }
        } else if (a.action_type === "prepare_sarb_packet") {
          desc = `SARB packet assembled${cd?.referral_destination ? ` — ${cd.referral_destination}` : ""}`;
        }
        timeline.push({ date: a.completed_at.slice(0, 10), description: desc });
      }
    }

    // Add tier escalation events
    if (caseData.tier_1_triggered_at) {
      timeline.push({ date: caseData.tier_1_triggered_at.slice(0, 10), description: "Case opened — Tier 1 triggered" });
    }
    if (caseData.tier_2_triggered_at) {
      timeline.push({ date: caseData.tier_2_triggered_at.slice(0, 10), description: "Case escalated to Tier 2" });
    }
    if (caseData.tier_3_triggered_at) {
      timeline.push({ date: caseData.tier_3_triggered_at.slice(0, 10), description: "Case escalated to Tier 3" });
    }

    // Add interventions to timeline
    for (const iv of ivData ?? []) {
      timeline.push({
        date: iv.intervention_date,
        description: `Intervention: ${iv.intervention_type.replace(/_/g, " ")}${iv.outcome ? ` — ${iv.outcome}` : ""}`,
      });
    }

    timeline.sort((a, b) => a.date.localeCompare(b.date));

    // Build interventions list
    const interventions: InterventionEntry[] = (ivData ?? []).map((iv: Record<string, unknown>) => ({
      date: iv.intervention_date as string,
      type: (iv.intervention_type as string).replace(/_/g, " "),
      performedBy: (iv.performed_by_name as string) ?? "—",
      outcome: (iv.outcome as string) ?? "—",
    }));

    const packetData: SarbPacketData = {
      student: {
        firstName: (s?.first_name as string) ?? "Unknown",
        lastName: (s?.last_name as string) ?? "Unknown",
        grade: (s?.grade_level as string) ?? "",
        dateOfBirth: (s?.date_of_birth as string) ?? null,
        enrollmentDate: (s?.enrollment_date as string) ?? null,
      },
      school: {
        name: (sc?.name as string) ?? "Unknown",
        address: (sc?.address as string) ?? "",
        phone: (sc?.phone as string) ?? "",
        principalName: (sc?.principal_name as string) ?? "",
      },
      district: { name: "", address: "" }, // filled by caller or from settings
      case_: {
        id: caseData.id,
        currentTier: caseData.current_tier,
        academicYear: caseData.academic_year,
        tierRequirements: (caseData.tier_requirements as Record<string, unknown>) ?? {},
        unexcusedAbsenceCount: caseData.unexcused_absence_count ?? 0,
        truancyCount: caseData.truancy_count ?? 0,
        totalAbsenceCount: caseData.total_absence_count ?? 0,
        createdAt: caseData.created_at,
        tier1TriggeredAt: caseData.tier_1_triggered_at,
        tier2TriggeredAt: caseData.tier_2_triggered_at,
        tier3TriggeredAt: caseData.tier_3_triggered_at,
      },
      snapshot: snapData
        ? {
            daysEnrolled: snapData.days_enrolled,
            daysPresent: snapData.days_present,
            daysAbsent: snapData.days_absent,
            daysAbsentUnexcused: snapData.days_absent_unexcused ?? 0,
            attendanceRate: snapData.attendance_rate ?? 0,
            isChronicAbsent: snapData.is_chronic_absent ?? false,
          }
        : { daysEnrolled: 0, daysPresent: 0, daysAbsent: 0, daysAbsentUnexcused: 0, attendanceRate: 0, isChronicAbsent: false },
      monthlyAttendance,
      timeline,
      interventions,
      preparedBy: "",
      date: new Date().toISOString().slice(0, 10),
    };

    return generateSARBPacketFromData(packetData);
  } catch (err) {
    throw handleServiceError("generate SARB packet", err);
  }
}
