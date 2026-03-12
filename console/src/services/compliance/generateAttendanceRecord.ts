/**
 * Attendance Record generation service.
 *
 * Fetches attendance data, delegates PDF creation to the pure generator
 * in lib/documents/attendance-record.ts, downloads the blob, and
 * persists the record via saveDocument.
 */
import { supabase } from "@/lib/supabase";
import {
  buildAttendanceRecordPDF,
  type MonthRow,
  type AttendanceRecordInput,
} from "@/lib/documents/attendance-record";
import { saveDocument } from "@/services/documents/saveDocument";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

function monthKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const idx = parseInt(month, 10) - 1;
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[idx]} ${year}`;
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

export async function generateAttendanceRecord(
  caseId: string,
  workspaceData: CaseWorkspaceResponse
): Promise<{ success: boolean; error?: string }> {
  try {
    const c = workspaceData.case;
    const nameParts = c.studentName.split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const today = new Date().toISOString().slice(0, 10);

    // 1. Fetch attendance data
    const { data: attendanceRows } = await supabase
      .from("attendance_daily")
      .select("calendar_date, canonical_type, counts_as_truancy")
      .eq("student_id", c.studentId)
      .gte("calendar_date", "2025-07-01")
      .lte("calendar_date", "2026-06-30")
      .order("calendar_date", { ascending: true });

    const rows = attendanceRows ?? [];

    // 2. Build monthly breakdown
    const monthMap = new Map<
      string,
      { enrolled: number; present: number; excused: number; unexcused: number; tardies: number; truancy: number }
    >();

    for (const row of rows) {
      const mk = monthKey(row.calendar_date);
      if (!monthMap.has(mk)) {
        monthMap.set(mk, { enrolled: 0, present: 0, excused: 0, unexcused: 0, tardies: 0, truancy: 0 });
      }
      const m = monthMap.get(mk)!;
      m.enrolled++;

      const ct = row.canonical_type as string;
      if (ct === "present" || ct === "present_partial") {
        m.present++;
      } else if (ct === "absent_excused") {
        m.excused++;
      } else if (ct === "absent_unexcused" || ct === "absent_unverified") {
        m.unexcused++;
      } else if (ct === "tardy" || ct === "tardy_excused" || ct === "tardy_unexcused") {
        m.tardies++;
        m.present++; // tardies count as present
      } else {
        // suspension, etc
        m.present++;
      }

      if (row.counts_as_truancy) {
        m.truancy++;
      }
    }

    const monthRows: MonthRow[] = [];
    const sortedKeys = Array.from(monthMap.keys()).sort();
    for (const key of sortedKeys) {
      const m = monthMap.get(key)!;
      monthRows.push({
        month: monthLabel(key),
        daysEnrolled: m.enrolled,
        present: m.present,
        absentExcused: m.excused,
        absentUnexcused: m.unexcused,
        tardies: m.tardies,
        truancy: m.truancy,
      });
    }

    // 3. Build typed input for pure PDF generator
    const metrics = workspaceData.metrics;
    const pdfInput: AttendanceRecordInput = {
      student: {
        firstName,
        lastName,
        grade: c.grade,
        ssid: c.ssid ?? undefined,
      },
      school: { name: c.schoolName },
      district: { name: c.districtName },
      date: today,
      metrics: {
        daysEnrolled: metrics.daysEnrolled,
        attendanceRate: metrics.attendanceRate,
        totalAbsences: metrics.totalAbsences,
        unexcusedAbsences: metrics.unexcusedAbsences,
        excusedAbsences: metrics.excusedAbsences,
        tardies: metrics.tardies,
        truancyCount: metrics.truancyCount,
      },
      monthRows,
    };

    // 4. Generate PDF (pure function — returns Blob)
    const blob = buildAttendanceRecordPDF(pdfInput);

    // 5. Download
    downloadBlob(blob, `Attendance-Record-${lastName}-${firstName}-${today}.pdf`);

    // 6. Persist document record via saveDocument service
    const now = new Date().toISOString();
    const totals = monthRows.reduce(
      (acc, row) => ({
        enrolled: acc.enrolled + row.daysEnrolled,
        present: acc.present + row.present,
        excused: acc.excused + row.absentExcused,
        unexcused: acc.unexcused + row.absentUnexcused,
        tardies: acc.tardies + row.tardies,
        truancy: acc.truancy + row.truancy,
      }),
      { enrolled: 0, present: 0, excused: 0, unexcused: 0, tardies: 0, truancy: 0 }
    );

    await saveDocument({
      caseId,
      studentId: c.studentId,
      schoolId: c.schoolId,
      docType: "attendance_record",
      title: `Attendance Record — ${c.studentName}`,
      contentJson: { monthRows, totals, generatedAt: now },
    });

    return { success: true };
  } catch (e) {
    console.error("generateAttendanceRecord: unexpected error", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unexpected error",
    };
  }
}
