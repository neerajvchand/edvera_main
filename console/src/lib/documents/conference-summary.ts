/**
 * Generates a Tier 2 Parent Conference Summary PDF.
 *
 * This document captures the structured outcome of a parent conference
 * per EC §48262 requirements and is filed in the student cumulative file.
 */
import { jsPDF } from "jspdf";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ConferenceSummaryInput {
  student: { firstName: string; lastName: string; grade: string };
  school: { name: string };
  district: { name: string };
  currentTier: string;
  conferenceDate: string;
  status: string; // held_parent_attended, held_parent_absent, attempted, rescheduled
  attendees: string[];
  resources: string[];
  consequencesExplained: boolean;
  commitments: string;
  followUpDate: string;
  notes: string;
  attendanceSummary?: {
    daysEnrolled: number;
    daysAbsent: number;
    attendanceRate: number;
    unexcusedAbsences: number;
    truancyNoticesSent: number;
  };
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
  grayBg: [248, 250, 252] as RGB,
  grayBorder: [226, 232, 240] as RGB,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const TIER_DISPLAY: Record<string, string> = {
  tier_1_letter: "Tier 1 — Notification Letter",
  tier_2_conference: "Tier 2 — Conference",
  tier_3_sarb_referral: "Tier 3 — SARB Referral",
};

const STATUS_DISPLAY: Record<string, string> = {
  held_parent_attended: "Held — Parent Attended",
  held_parent_absent: "Held — Parent Absent",
  attempted: "Attempted — Unable to Reach",
  rescheduled: "Rescheduled",
};

const ALL_ATTENDEES = ["Parent/Guardian", "School Counselor", "Principal", "Teacher", "Student", "Other"];
const ALL_RESOURCES = [
  "Transportation assistance",
  "Counseling referral",
  "Tutoring",
  "Community resources",
  "Mentoring program",
  "After-school program",
];

function checkbox(checked: boolean): string {
  return checked ? "☑" : "☐";
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

export function generateConferenceSummary(input: ConferenceSummaryInput): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const ML = 72;
  const MR = 72;
  const CW = W - ML - MR;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);

  let y = 72;

  // --- Title ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(C.navy);
  doc.text("PARENT CONFERENCE SUMMARY", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);
  doc.text(`${input.district.name} — ${input.school.name}`, ML, y);
  y += 10;

  setDraw(C.emerald);
  doc.setLineWidth(1.5);
  doc.line(ML, y, W - MR, y);
  y += 24;

  // --- Student info row ---
  doc.setFontSize(10);
  setColor(C.body);
  const infoCol1 = ML;
  const infoCol2 = ML + 200;
  const infoCol3 = ML + 340;

  doc.setFont("helvetica", "bold");
  doc.text("Student:", infoCol1, y);
  doc.text("Grade:", infoCol2, y);
  doc.text("Date:", infoCol3, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.text(`${input.student.firstName} ${input.student.lastName}`, infoCol1, y);
  doc.text(input.student.grade, infoCol2, y);
  doc.text(fmtDate(input.conferenceDate), infoCol3, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.text("Case:", infoCol1, y);
  doc.text("Status:", infoCol2, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.text(`Truancy — ${TIER_DISPLAY[input.currentTier] ?? input.currentTier}`, infoCol1, y);
  doc.text(STATUS_DISPLAY[input.status] ?? input.status.replace(/_/g, " "), infoCol2, y);
  y += 28;

  // --- Attendees ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("ATTENDEES:", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);

  const attLeft = ML;
  const attRight = ML + CW / 2;
  let attY = y;
  const attendeeLower = input.attendees.map((a) => a.toLowerCase());

  for (let i = 0; i < ALL_ATTENDEES.length; i++) {
    const checked = attendeeLower.includes(ALL_ATTENDEES[i].toLowerCase());
    const x = i % 2 === 0 ? attLeft : attRight;
    if (i > 0 && i % 2 === 0) attY += 16;
    doc.text(`${checkbox(checked)} ${ALL_ATTENDEES[i]}`, x, attY);
  }
  y = attY + 28;

  // --- Attendance Summary ---
  if (input.attendanceSummary) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setColor(C.navy);
    doc.text("ATTENDANCE SUMMARY AT TIME OF CONFERENCE:", ML, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(C.body);
    const as = input.attendanceSummary;
    doc.text(`Days Enrolled: ${as.daysEnrolled}      Days Absent: ${as.daysAbsent}      Attendance Rate: ${as.attendanceRate}%`, ML, y);
    y += 15;
    doc.text(`Unexcused Absences: ${as.unexcusedAbsences}      Truancy Notices Sent: ${as.truancyNoticesSent}`, ML, y);
    y += 28;
  }

  // --- Discussion Summary ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("DISCUSSION SUMMARY:", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);

  if (input.notes) {
    const noteLines = doc.splitTextToSize(input.notes, CW) as string[];
    for (const line of noteLines) {
      if (y > H - 120) {
        addFooter(doc, ML, W, H, input.student, input.district);
        doc.addPage();
        y = 72;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        setColor(C.body);
      }
      doc.text(line, ML, y);
      y += 14;
    }
  } else {
    doc.text("[No notes recorded]", ML, y);
    y += 14;
  }
  y += 14;

  // --- Resources Offered ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("RESOURCES OFFERED:", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);

  const resLower = input.resources.map((r) => r.toLowerCase());
  for (const resource of ALL_RESOURCES) {
    const checked = resLower.includes(resource.toLowerCase());
    doc.text(`${checkbox(checked)} ${resource}`, ML, y);
    y += 16;
  }
  y += 12;

  // --- Parent Informed Of ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("PARENT INFORMED OF:", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);
  doc.text(`${checkbox(input.consequencesExplained)} Consequences of continued truancy per EC §48262`, ML, y);
  y += 16;
  doc.text(`${checkbox(input.consequencesExplained)} Possible SARB referral if attendance does not improve`, ML, y);
  y += 16;
  doc.text(`${checkbox(true)} Right to due process`, ML, y);
  y += 24;

  // --- Commitments ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("COMMITMENTS:", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);
  if (input.commitments) {
    const commitLines = doc.splitTextToSize(input.commitments, CW) as string[];
    for (const line of commitLines) {
      if (y > H - 120) {
        addFooter(doc, ML, W, H, input.student, input.district);
        doc.addPage();
        y = 72;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        setColor(C.body);
      }
      doc.text(line, ML, y);
      y += 14;
    }
  } else {
    doc.text("[No commitments recorded]", ML, y);
    y += 14;
  }
  y += 14;

  // --- Follow-Up ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("FOLLOW-UP:", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);
  doc.text(input.followUpDate ? fmtDate(input.followUpDate) : "[No follow-up date set]", ML, y);
  y += 40;

  // --- Signature lines ---
  if (y > H - 140) {
    addFooter(doc, ML, W, H, input.student, input.district);
    doc.addPage();
    y = 72;
  }

  setDraw(C.grayBorder);
  doc.setLineWidth(0.5);

  const sigWidth = (CW - 40) / 2;
  // Left signature
  doc.line(ML, y, ML + sigWidth, y);
  y += 14;
  doc.setFontSize(9);
  setColor(C.light);
  doc.text("School Representative", ML, y);

  // Right signature
  doc.line(ML + sigWidth + 40, y - 14, W - MR, y - 14);
  doc.text("Parent/Guardian Signature", ML + sigWidth + 40, y);
  doc.text("(if signed)", ML + sigWidth + 40, y + 12);
  y += 28;

  doc.line(ML, y, ML + 100, y);
  y += 14;
  doc.text("Date:", ML, y);
  y += 24;

  // CC
  doc.setFontSize(9);
  setColor(C.light);
  doc.text("cc: Student cumulative file, Compliance case file", ML, y);

  addFooter(doc, ML, W, H, input.student, input.district);

  return doc.output("blob");
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function addFooter(
  doc: jsPDF,
  ML: number,
  W: number,
  H: number,
  student: { firstName: string; lastName: string },
  district: { name: string }
) {
  const fy = H - 36;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Confidential Student Record — FERPA Protected", ML, fy);
  doc.text(
    `${district.name} — Conference Summary — ${student.firstName} ${student.lastName}`,
    W / 2,
    fy,
    { align: "center" }
  );
}
