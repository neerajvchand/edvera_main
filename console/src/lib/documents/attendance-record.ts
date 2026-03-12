/**
 * Pure PDF generator for Student Attendance Records.
 *
 * Accepts typed data and returns a Blob — no database or network calls.
 * Renders a monthly breakdown table with absence types and YTD summary.
 */
import { jsPDF } from "jspdf";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

export interface MonthRow {
  month: string;
  daysEnrolled: number;
  present: number;
  absentExcused: number;
  absentUnexcused: number;
  tardies: number;
  truancy: number;
}

export interface AttendanceRecordInput {
  student: {
    firstName: string;
    lastName: string;
    grade: string;
    ssid?: string;
  };
  school: { name: string };
  district: { name: string };
  date: string;
  metrics: {
    daysEnrolled: number;
    attendanceRate: number;
    totalAbsences: number;
    unexcusedAbsences: number;
    excusedAbsences: number;
    tardies: number;
    truancyCount: number;
  };
  monthRows: MonthRow[];
}

/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

const C = {
  navy: [30, 41, 59] as RGB,
  body: [71, 85, 105] as RGB,
  light: [148, 163, 184] as RGB,
  emerald: [5, 150, 105] as RGB,
  grayBg: [248, 250, 252] as RGB,
  grayBorder: [226, 232, 240] as RGB,
};

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function addFooter(
  doc: jsPDF,
  ML: number,
  W: number,
  H: number,
  firstName: string,
  lastName: string,
  districtName: string
) {
  const fy = H - 30;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Confidential Student Record — FERPA Protected", ML, fy);
  doc.text(
    `${districtName} — Attendance Record — ${firstName} ${lastName}`,
    W / 2,
    fy,
    { align: "center" }
  );
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

export function buildAttendanceRecordPDF(input: AttendanceRecordInput): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const ML = 54;
  const MR = 54;
  const CW = W - ML - MR;

  const setColor = (rgb: RGB) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: RGB) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb: RGB) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);

  const { firstName, lastName, grade, ssid } = input.student;
  const m = input.metrics;
  let y = 54;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(C.navy);
  doc.text("STUDENT ATTENDANCE RECORD", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);
  doc.text(`${input.district.name} — ${input.school.name}`, ML, y);
  y += 10;

  setDraw(C.emerald);
  doc.setLineWidth(1.5);
  doc.line(ML, y, W - MR, y);
  y += 20;

  // Student info
  doc.setFontSize(10);
  setColor(C.body);
  doc.setFont("helvetica", "bold");
  doc.text("Student:", ML, y);
  doc.text("Grade:", ML + 200, y);
  doc.text("Date:", ML + 340, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.text(`${firstName} ${lastName}`, ML, y);
  doc.text(grade, ML + 200, y);
  doc.text(input.date, ML + 340, y);
  y += 8;

  if (ssid) {
    doc.text(`SSID: ${ssid}`, ML, y + 12);
    y += 12;
  }
  y += 20;

  // Summary stats
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("YEAR-TO-DATE SUMMARY:", ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);
  doc.text(
    `Days Enrolled: ${m.daysEnrolled}      Attendance Rate: ${m.attendanceRate}%      Total Absences: ${m.totalAbsences}`,
    ML,
    y
  );
  y += 15;
  doc.text(
    `Unexcused: ${m.unexcusedAbsences}      Excused: ${m.excusedAbsences}      Tardies: ${m.tardies}      Truancy Count: ${m.truancyCount}`,
    ML,
    y
  );
  y += 24;

  // Monthly table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text("MONTHLY BREAKDOWN:", ML, y);
  y += 16;

  // Table header
  const cols = [
    { label: "Month", x: ML, w: 110 },
    { label: "Enrolled", x: ML + 115, w: 60 },
    { label: "Present", x: ML + 180, w: 55 },
    { label: "Excused", x: ML + 240, w: 55 },
    { label: "Unexcused", x: ML + 300, w: 65 },
    { label: "Tardy", x: ML + 370, w: 45 },
    { label: "Truancy", x: ML + 420, w: 55 },
  ];

  setFill(C.grayBg);
  doc.rect(ML, y - 10, CW, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setColor(C.navy);
  for (const col of cols) {
    doc.text(col.label, col.x + 2, y);
  }
  y += 12;

  setDraw(C.grayBorder);
  doc.setLineWidth(0.5);
  doc.line(ML, y - 4, W - MR, y - 4);

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(C.body);

  const totals = { enrolled: 0, present: 0, excused: 0, unexcused: 0, tardies: 0, truancy: 0 };

  for (const row of input.monthRows) {
    if (y > H - 80) {
      addFooter(doc, ML, W, H, firstName, lastName, input.district.name);
      doc.addPage();
      y = 54;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setColor(C.body);
    }

    doc.text(row.month, cols[0].x + 2, y);
    doc.text(String(row.daysEnrolled), cols[1].x + 2, y);
    doc.text(String(row.present), cols[2].x + 2, y);
    doc.text(String(row.absentExcused), cols[3].x + 2, y);
    doc.text(String(row.absentUnexcused), cols[4].x + 2, y);
    doc.text(String(row.tardies), cols[5].x + 2, y);
    doc.text(String(row.truancy), cols[6].x + 2, y);

    totals.enrolled += row.daysEnrolled;
    totals.present += row.present;
    totals.excused += row.absentExcused;
    totals.unexcused += row.absentUnexcused;
    totals.tardies += row.tardies;
    totals.truancy += row.truancy;

    y += 14;
  }

  // Totals row
  doc.line(ML, y - 4, W - MR, y - 4);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", cols[0].x + 2, y);
  doc.text(String(totals.enrolled), cols[1].x + 2, y);
  doc.text(String(totals.present), cols[2].x + 2, y);
  doc.text(String(totals.excused), cols[3].x + 2, y);
  doc.text(String(totals.unexcused), cols[4].x + 2, y);
  doc.text(String(totals.tardies), cols[5].x + 2, y);
  doc.text(String(totals.truancy), cols[6].x + 2, y);

  // Footer
  addFooter(doc, ML, W, H, firstName, lastName, input.district.name);

  return doc.output("blob");
}
