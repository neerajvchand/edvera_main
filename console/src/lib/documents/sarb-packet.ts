/**
 * Pure SARB (School Attendance Review Board) Referral Packet PDF builder.
 *
 * Accepts typed data and returns a Blob — no database or network calls.
 * Data fetching is handled by services/documents/generateSarbPacket.ts.
 *
 * Pages:
 *   1. Cover Letter
 *   2. Student Information
 *   3. Attendance History
 *   4. Compliance Timeline
 *   5. Intervention Summary
 *   6. Tier Completion Verification
 *   7. School Recommendation
 */
import { jsPDF } from "jspdf";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SarbStudentInfo {
  firstName: string;
  lastName: string;
  grade: string;
  dateOfBirth: string | null;
  enrollmentDate: string | null;
}

export interface SarbSchoolInfo {
  name: string;
  address: string;
  phone: string;
  principalName: string;
}

export interface SarbDistrictInfo {
  name: string;
  address: string;
}

export interface SarbCaseInfo {
  id: string;
  currentTier: string;
  academicYear: string;
  tierRequirements: Record<string, unknown>;
  unexcusedAbsenceCount: number;
  truancyCount: number;
  totalAbsenceCount: number;
  createdAt: string;
  tier1TriggeredAt: string | null;
  tier2TriggeredAt: string | null;
  tier3TriggeredAt: string | null;
}

export interface SarbSnapshot {
  daysEnrolled: number;
  daysPresent: number;
  daysAbsent: number;
  daysAbsentUnexcused: number;
  attendanceRate: number;
  isChronicAbsent: boolean;
}

export interface MonthlyAttendance {
  month: string;
  daysEnrolled: number;
  daysAbsent: number;
  excused: number;
  unexcused: number;
  rate: number;
}

export interface TimelineEntry {
  date: string;
  description: string;
}

export interface InterventionEntry {
  date: string;
  type: string;
  performedBy: string;
  outcome: string;
}

export interface SarbPacketData {
  student: SarbStudentInfo;
  school: SarbSchoolInfo;
  district: SarbDistrictInfo;
  case_: SarbCaseInfo;
  snapshot: SarbSnapshot;
  monthlyAttendance: MonthlyAttendance[];
  timeline: TimelineEntry[];
  interventions: InterventionEntry[];
  preparedBy: string;
  date: string;
}

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const C = {
  navy: [30, 41, 59] as RGB,
  body: [71, 85, 105] as RGB,
  light: [148, 163, 184] as RGB,
  emerald: [5, 150, 105] as RGB,
  red: [220, 38, 38] as RGB,
  amber: [217, 119, 6] as RGB,
  white: [255, 255, 255] as RGB,
  grayBg: [248, 250, 252] as RGB,
  grayBorder: [226, 232, 240] as RGB,
  headerBg: [241, 245, 249] as RGB,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getAttendanceBand(rate: number): string {
  if (rate >= 96) return "Satisfactory (≥96%)";
  if (rate >= 91) return "At Risk (91-95%)";
  if (rate >= 82) return "Chronic (82-90%)";
  return "Severe Chronic (<82%)";
}

const TIER_DISPLAY: Record<string, string> = {
  tier_1_letter: "Tier 1 — Notification Letter",
  tier_2_conference: "Tier 2 — Conference",
  tier_3_sarb_referral: "Tier 3 — SARB Referral",
};

/* ------------------------------------------------------------------ */
/* Data Fetcher                                                        */
/* ------------------------------------------------------------------ */

/**
 * Builds the SARB packet PDF from pre-fetched data.
 * The caller can set district info, preparedBy, etc. before calling.
 */
export function generateSARBPacketFromData(
  data: SarbPacketData
): Blob {
  return buildSarbPdf(data);
}

/* ------------------------------------------------------------------ */
/* PDF Builder                                                         */
/* ------------------------------------------------------------------ */

function buildSarbPdf(data: SarbPacketData): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const ML = 54;
  const MR = 54;
  const CW = W - ML - MR;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  let totalPages = 7;
  let currentPage = 1;

  const studentFullName = `${data.student.firstName} ${data.student.lastName}`;

  function addPageFooter() {
    const fy = H - 30;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(C.light);
    doc.text("Confidential Student Record — FERPA Protected", ML, fy);
    doc.text(`Page ${currentPage} of ${totalPages}`, W / 2, fy, { align: "center" });
    doc.text(
      `${data.district.name || "District"} — SARB Referral Packet — ${studentFullName} — ${fmtDate(data.date)}`,
      W - MR,
      fy,
      { align: "right" }
    );
  }

  function newPage() {
    addPageFooter();
    doc.addPage();
    currentPage++;
  }

  function sectionHeader(title: string, y: number): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(C.navy);
    doc.text(title, ML, y);
    y += 6;
    setDraw(C.emerald);
    doc.setLineWidth(1);
    doc.line(ML, y, W - MR, y);
    return y + 16;
  }

  function miniHeader(): number {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setColor(C.light);
    doc.text(`SARB Referral — ${studentFullName}`, ML, 40);
    doc.text(fmtDate(data.date), W - MR, 40, { align: "right" });
    return 56;
  }

  // ============================================================
  // PAGE 1 — COVER LETTER
  // ============================================================

  let y = 72;

  // District letterhead
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(C.navy);
  doc.text(data.district.name || "School District", ML, y);
  y += 16;

  if (data.district.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(C.body);
    for (const line of data.district.address.split("\n")) {
      doc.text(line, ML, y);
      y += 13;
    }
  }
  y += 8;

  setDraw(C.emerald);
  doc.setLineWidth(1.5);
  doc.line(ML, y, W - MR, y);
  y += 28;

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setColor(C.body);
  doc.text(fmtDate(data.date), ML, y);
  y += 28;

  // To
  doc.setFont("helvetica", "bold");
  doc.text("To:", ML, y);
  doc.setFont("helvetica", "normal");
  doc.text("School Attendance Review Board", ML + 24, y);
  y += 20;

  // Re
  doc.setFont("helvetica", "bold");
  doc.text("Re:", ML, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Referral of ${studentFullName}, Grade ${data.student.grade}, ${data.school.name}`,
    ML + 24,
    y
  );
  y += 28;

  // Body
  doc.text("Dear Board Members,", ML, y);
  y += 22;

  const coverBody = doc.splitTextToSize(
    `This student has been identified as a habitual truant under California Education Code Section 48262. ${data.school.name} has completed all required interventions at Tier 1 (notification) and Tier 2 (conference) without sufficient improvement in attendance. We respectfully refer this case to the School Attendance Review Board for further intervention.`,
    CW
  ) as string[];

  for (const line of coverBody) {
    doc.text(line, ML, y);
    y += 16;
  }
  y += 10;

  const coverBody2 = doc.splitTextToSize(
    `This packet contains the student's attendance history, a chronological record of all compliance actions and interventions taken by the school, and verification that all prior tier requirements have been met. The school is committed to working with the Board to develop an effective plan for improving this student's attendance.`,
    CW
  ) as string[];

  for (const line of coverBody2) {
    doc.text(line, ML, y);
    y += 16;
  }
  y += 30;

  // Signature
  doc.text("Sincerely,", ML, y);
  y += 36;

  doc.setFont("helvetica", "bold");
  doc.text(data.preparedBy || "School Administrator", ML, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.text(data.school.name, ML, y);
  y += 15;
  doc.text(data.district.name || "", ML, y);
  y += 36;

  // Signature line
  setDraw(C.grayBorder);
  doc.setLineWidth(0.5);
  doc.line(ML, y, ML + 200, y);
  y += 14;
  doc.setFontSize(9);
  setColor(C.light);
  doc.text("Signature / Date", ML, y);

  // ============================================================
  // PAGE 2 — STUDENT INFORMATION
  // ============================================================
  newPage();
  y = miniHeader();
  y = sectionHeader("Student Information", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setColor(C.body);

  const infoRows = [
    ["Name", studentFullName],
    ["Date of Birth", data.student.dateOfBirth ? fmtDate(data.student.dateOfBirth) : "—"],
    ["Grade", data.student.grade || "—"],
    ["School", data.school.name],
    ["Enrollment Date", data.student.enrollmentDate ? fmtDate(data.student.enrollmentDate) : "—"],
    ["Academic Year", data.case_.academicYear],
  ];

  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, ML, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, ML + 120, y);
    y += 18;
  }
  y += 16;

  // Attendance summary box
  y = sectionHeader("Current Attendance Summary", y);

  setFill(C.grayBg);
  setDraw(C.grayBorder);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, y - 4, CW, 80, 4, 4, "FD");

  const snap = data.snapshot;
  const boxCols = [
    { label: "Days Enrolled", value: String(snap.daysEnrolled) },
    { label: "Days Present", value: String(snap.daysPresent) },
    { label: "Days Absent", value: String(snap.daysAbsent) },
    { label: "Attendance Rate", value: `${snap.attendanceRate}%` },
  ];

  const colW = CW / boxCols.length;
  for (let i = 0; i < boxCols.length; i++) {
    const cx = ML + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(C.light);
    doc.text(boxCols[i].label, cx, y + 20, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    const valColor = i === 3
      ? (snap.attendanceRate < 82 ? C.red : snap.attendanceRate < 91 ? C.amber : C.emerald)
      : C.navy;
    setColor(valColor);
    doc.text(boxCols[i].value, cx, y + 48, { align: "center" });
  }
  y += 88;

  // Classification
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  setColor(C.navy);
  doc.text("Attendance Works Classification:", ML, y);
  doc.setFont("helvetica", "normal");
  const band = getAttendanceBand(snap.attendanceRate);
  const bandColor = snap.attendanceRate < 82 ? C.red : snap.attendanceRate < 91 ? C.amber : C.emerald;
  setColor(bandColor);
  doc.text(band, ML + 200, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  setColor(C.navy);
  doc.text("Chronic Absent:", ML, y);
  doc.setFont("helvetica", "normal");
  setColor(snap.isChronicAbsent ? C.red : C.emerald);
  doc.text(snap.isChronicAbsent ? "Yes" : "No", ML + 200, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  setColor(C.navy);
  doc.text("Unexcused Absences:", ML, y);
  doc.setFont("helvetica", "normal");
  setColor(C.body);
  doc.text(String(snap.daysAbsentUnexcused), ML + 200, y);

  // ============================================================
  // PAGE 3 — ATTENDANCE HISTORY
  // ============================================================
  newPage();
  y = miniHeader();
  y = sectionHeader("Attendance History — Monthly Summary", y);

  // Table header
  const tableCols = [
    { label: "Month", x: ML, w: 140, align: "left" as const },
    { label: "Enrolled", x: ML + 150, w: 60, align: "right" as const },
    { label: "Absent", x: ML + 220, w: 60, align: "right" as const },
    { label: "Excused", x: ML + 290, w: 60, align: "right" as const },
    { label: "Unexcused", x: ML + 360, w: 60, align: "right" as const },
    { label: "Rate", x: ML + 430, w: 60, align: "right" as const },
  ];

  const rowH = 20;

  // Header row
  setFill(C.headerBg);
  doc.rect(ML, y - 12, CW, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(C.navy);
  for (const col of tableCols) {
    const tx = col.align === "right" ? col.x + col.w : col.x + 4;
    doc.text(col.label, tx, y, { align: col.align });
  }
  y += rowH;

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (let i = 0; i < data.monthlyAttendance.length; i++) {
    const row = data.monthlyAttendance[i];
    if (i % 2 === 0) {
      setFill(C.grayBg);
      doc.rect(ML, y - 12, CW, rowH, "F");
    }
    setColor(C.body);
    doc.text(row.month, tableCols[0].x + 4, y);
    doc.text(String(row.daysEnrolled), tableCols[1].x + tableCols[1].w, y, { align: "right" });
    doc.text(String(row.daysAbsent), tableCols[2].x + tableCols[2].w, y, { align: "right" });
    doc.text(String(row.excused), tableCols[3].x + tableCols[3].w, y, { align: "right" });
    doc.text(String(row.unexcused), tableCols[4].x + tableCols[4].w, y, { align: "right" });

    const rateColor = row.rate < 82 ? C.red : row.rate < 91 ? C.amber : C.body;
    setColor(rateColor);
    doc.text(`${row.rate}%`, tableCols[5].x + tableCols[5].w, y, { align: "right" });
    y += rowH;
  }

  // Total row
  y += 4;
  setDraw(C.grayBorder);
  doc.setLineWidth(0.5);
  doc.line(ML, y - 12, W - MR, y - 12);
  doc.setFont("helvetica", "bold");
  setColor(C.navy);
  doc.text("Total / Current", tableCols[0].x + 4, y);
  doc.text(String(snap.daysEnrolled), tableCols[1].x + tableCols[1].w, y, { align: "right" });
  doc.text(String(snap.daysAbsent), tableCols[2].x + tableCols[2].w, y, { align: "right" });
  doc.text(String(snap.daysAbsentUnexcused), tableCols[4].x + tableCols[4].w, y, { align: "right" });
  const totalRate = snap.attendanceRate;
  const totalRateColor = totalRate < 82 ? C.red : totalRate < 91 ? C.amber : C.emerald;
  setColor(totalRateColor);
  doc.text(`${totalRate}%`, tableCols[5].x + tableCols[5].w, y, { align: "right" });

  // ============================================================
  // PAGE 4 — COMPLIANCE TIMELINE
  // ============================================================
  newPage();
  y = miniHeader();
  y = sectionHeader("Compliance Timeline", y);

  doc.setFontSize(9);
  for (const entry of data.timeline) {
    if (y > H - 60) {
      newPage();
      y = miniHeader();
      y = sectionHeader("Compliance Timeline (continued)", y);
      doc.setFontSize(9);
    }

    doc.setFont("helvetica", "bold");
    setColor(C.navy);
    doc.text(fmtShortDate(entry.date), ML, y);

    doc.setFont("helvetica", "normal");
    setColor(C.body);
    const descLines = doc.splitTextToSize(`— ${entry.description}`, CW - 100) as string[];
    for (let j = 0; j < descLines.length; j++) {
      doc.text(descLines[j], ML + 100, y + j * 13);
    }
    y += Math.max(descLines.length * 13, 13) + 6;
  }

  if (data.timeline.length === 0) {
    doc.setFont("helvetica", "normal");
    setColor(C.light);
    doc.text("No compliance events recorded.", ML, y);
  }

  // ============================================================
  // PAGE 5 — INTERVENTION SUMMARY
  // ============================================================
  newPage();
  y = miniHeader();
  y = sectionHeader("Intervention Summary", y);

  if (data.interventions.length > 0) {
    const ivCols = [
      { label: "Date", x: ML, w: 90, align: "left" as const },
      { label: "Type", x: ML + 95, w: 120, align: "left" as const },
      { label: "Performed By", x: ML + 220, w: 120, align: "left" as const },
      { label: "Outcome", x: ML + 345, w: 160, align: "left" as const },
    ];

    setFill(C.headerBg);
    doc.rect(ML, y - 12, CW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(C.navy);
    for (const col of ivCols) {
      doc.text(col.label, col.x + 4, y);
    }
    y += rowH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (let i = 0; i < data.interventions.length; i++) {
      if (y > H - 60) {
        newPage();
        y = miniHeader();
        y = sectionHeader("Intervention Summary (continued)", y);
        doc.setFontSize(9);
      }
      const iv = data.interventions[i];
      if (i % 2 === 0) {
        setFill(C.grayBg);
        doc.rect(ML, y - 12, CW, rowH, "F");
      }
      setColor(C.body);
      doc.text(fmtShortDate(iv.date), ivCols[0].x + 4, y);
      doc.text(iv.type, ivCols[1].x + 4, y);
      doc.text(iv.performedBy, ivCols[2].x + 4, y);
      doc.text(iv.outcome.slice(0, 30), ivCols[3].x + 4, y);
      y += rowH;
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(C.light);
    doc.text("No interventions recorded.", ML, y);
  }

  // ============================================================
  // PAGE 6 — TIER COMPLETION VERIFICATION
  // ============================================================
  newPage();
  y = miniHeader();
  y = sectionHeader("Tier Completion Verification", y);

  const tr = data.case_.tierRequirements;
  const t1 = (tr?.tier_1 as Record<string, unknown>) ?? {};
  const t2 = (tr?.tier_2 as Record<string, unknown>) ?? {};
  const t3 = (tr?.tier_3 as Record<string, unknown>) ?? {};

  const notifSent = t1.notification_sent as Record<string, unknown> | undefined;
  const confHeld = t2.conference_held as Record<string, unknown> | undefined;
  const confAttempted = t2.conference_attempted as Record<string, unknown> | undefined;

  function tierCheck(doc: jsPDF, done: boolean, label: string, y: number): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(done ? C.emerald : C.red);
    doc.text(done ? "✅" : "❌", ML + 10, y);
    setColor(C.body);
    doc.text(label, ML + 30, y);
    return y + 18;
  }

  // Tier 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("Tier 1 Requirements:", ML, y);
  y += 20;

  const t1NotifDone = !!notifSent?.completed;
  y = tierCheck(doc, t1NotifDone, `Initial truancy notification sent${t1NotifDone && notifSent?.date ? `: ${fmtShortDate(notifSent.date as string)}` : ""}${t1NotifDone && notifSent?.method ? `, ${(notifSent.method as string).replace(/_/g, " ")}` : ""}`, y);
  y = tierCheck(doc, !!t1.notification_language_compliant, "Legally compliant language included (EC §48260.5)", y);
  y += 16;

  // Tier 2
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("Tier 2 Requirements:", ML, y);
  y += 20;

  const confDone = !!confHeld?.completed || !!confAttempted?.completed;
  y = tierCheck(doc, !!confAttempted?.completed || !!confHeld?.completed, `Conference attempted${confAttempted?.date ? `: ${fmtShortDate(confAttempted.date as string)}` : ""}`, y);
  if (confHeld?.completed) {
    y = tierCheck(doc, true, `Conference held${confHeld.date ? `: ${fmtShortDate(confHeld.date as string)}` : ""}`, y);
    if (confHeld.attendees && (confHeld.attendees as string[]).length > 0) {
      y = tierCheck(doc, true, `Attendees: ${(confHeld.attendees as string[]).join(", ")}`, y);
    }
  }
  y = tierCheck(doc, !!t2.resources_offered, `Resources offered${t2.resources_offered && typeof t2.resources_offered === "object" ? "" : ""}`, y);
  y = tierCheck(doc, !!t2.consequences_explained, "Parent informed of consequences per EC §48262", y);
  y += 16;

  // Tier 3 Readiness
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("Tier 3 Readiness:", ML, y);
  y += 20;

  const allTier1 = t1NotifDone && !!t1.notification_language_compliant;
  const allTier2 = confDone && !!t2.consequences_explained;
  y = tierCheck(doc, allTier1 && allTier2, "All prior tier requirements completed", y);
  y = tierCheck(doc, snap.isChronicAbsent || snap.attendanceRate < 90, "Attendance has not improved following interventions", y);

  // ============================================================
  // PAGE 7 — SCHOOL RECOMMENDATION
  // ============================================================
  newPage();
  y = miniHeader();
  y = sectionHeader("School Recommendation", y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setColor(C.body);

  const recommendations = [
    "Attendance contract with family",
    "Required counseling",
    "Community service",
    "Transfer to alternative program",
    "Referral to District Attorney (EC §48263.5)",
  ];

  for (const rec of recommendations) {
    doc.text(`☐  ${rec}`, ML + 10, y);
    y += 22;
  }
  y += 20;

  // School narrative section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("School Narrative:", ML, y);
  y += 20;

  setDraw(C.grayBorder);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, y - 4, CW, 120, 4, 4, "D");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(C.light);
  doc.text("[To be completed by school administrator]", ML + 12, y + 16);
  y += 140;

  // Signature block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(C.navy);
  doc.text("Submitted by:", ML, y);
  y += 28;

  setDraw(C.grayBorder);
  doc.setLineWidth(0.5);

  const sigW = (CW - 40) / 2;
  doc.line(ML, y, ML + sigW, y);
  doc.line(ML + sigW + 40, y, W - MR, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(C.light);
  doc.text("Name / Title", ML, y);
  doc.text("Date", ML + sigW + 40, y);

  // Final footer
  addPageFooter();

  return doc.output("blob");
}
