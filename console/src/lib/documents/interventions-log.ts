/**
 * Generates a SART Interventions Log PDF.
 *
 * Required SARB packet attachment — a formatted table of all interventions
 * attempted on a compliance case. Columns: Date, Type, Description, Staff, Response.
 */
import { jsPDF } from "jspdf";
import { formatPhoneNumber } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface InterventionLogEntry {
  date: string;
  type: string;
  description: string;
  staffMember: string;
  parentResponse: string;
}

export interface InterventionLogInput {
  student: { firstName: string; lastName: string; grade: string };
  school: { name: string };
  district: { name: string };
  caseCreatedAt: string;
  entries: InterventionLogEntry[];
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
  headerBg: [241, 245, 249] as RGB,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

export function generateInterventionLogPDF(input: InterventionLogInput): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = 792; // landscape width
  const H = 612; // landscape height
  const ML = 48;
  const MR = 48;
  const CW = W - ML - MR;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  const studentFullName = `${input.student.firstName} ${input.student.lastName}`;
  let currentPage = 1;

  function addFooter() {
    const fy = H - 26;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(C.light);
    doc.text("Confidential Student Record — FERPA Protected", ML, fy);
    doc.text(`SART Interventions Log — ${studentFullName}`, W / 2, fy, { align: "center" });
    doc.text(`Page ${currentPage}`, W - MR, fy, { align: "right" });
  }

  // Title
  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(C.navy);
  doc.text("SART Interventions Log", ML, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(C.body);
  doc.text(`${input.district.name} — ${input.school.name}`, ML, y + 14);
  doc.text(`Student: ${studentFullName}, Grade ${input.student.grade}`, ML, y + 26);
  doc.text(`Case opened: ${fmtDate(input.caseCreatedAt)}`, ML, y + 38);

  doc.text(`Prepared by: ${input.preparedBy}`, W - MR, y + 14, { align: "right" });
  doc.text(`Date: ${fmtDate(input.date)}`, W - MR, y + 26, { align: "right" });

  y += 52;
  setDraw(C.emerald);
  doc.setLineWidth(1);
  doc.line(ML, y, W - MR, y);
  y += 14;

  // Table columns
  const cols = [
    { label: "Date", x: ML, w: 80 },
    { label: "Intervention Type", x: ML + 84, w: 120 },
    { label: "Description", x: ML + 208, w: 200 },
    { label: "Staff Member", x: ML + 412, w: 120 },
    { label: "Parent/Guardian Response", x: ML + 536, w: CW - 536 + ML },
  ];
  const rowH = 22;

  function drawTableHeader(startY: number): number {
    setFill(C.headerBg);
    doc.rect(ML, startY - 12, CW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(C.navy);
    for (const col of cols) {
      doc.text(col.label.toUpperCase(), col.x + 4, startY);
    }
    return startY + rowH;
  }

  y = drawTableHeader(y);

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let i = 0; i < input.entries.length; i++) {
    if (y > H - 50) {
      addFooter();
      doc.addPage();
      currentPage++;
      y = 48;
      y = drawTableHeader(y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    const entry = input.entries[i];
    if (i % 2 === 0) {
      setFill(C.grayBg);
      doc.rect(ML, y - 12, CW, rowH, "F");
    }

    setColor(C.body);
    doc.text(fmtDate(entry.date), cols[0].x + 4, y);
    doc.text(entry.type.slice(0, 22), cols[1].x + 4, y);
    // Truncate long descriptions to fit
    const desc = entry.description.length > 45 ? entry.description.slice(0, 42) + "..." : entry.description;
    doc.text(desc, cols[2].x + 4, y);
    doc.text(entry.staffMember.slice(0, 22), cols[3].x + 4, y);
    const resp = entry.parentResponse.length > 25 ? entry.parentResponse.slice(0, 22) + "..." : entry.parentResponse;
    doc.text(resp, cols[4].x + 4, y);
    y += rowH;
  }

  if (input.entries.length === 0) {
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(C.light);
    doc.text("No interventions recorded.", ML, y);
  }

  addFooter();
  return doc.output("blob");
}
