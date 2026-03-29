/**
 * Generates a Tier 1 Truancy Notification Letter PDF per EC §48260.5.
 *
 * This is a legal document that California schools are required to send after
 * 3 unexcused absences. The language mirrors actual statutory requirements.
 */
import { jsPDF } from "jspdf";
import { formatPhoneNumber } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface TruancyLetterInput {
  student: { firstName: string; lastName: string; grade: string; dateOfBirth?: string };
  parent: { name: string; address: string };
  school: { name: string; address: string; phone: string; principalName: string };
  district: { name: string; address: string };
  absenceDates: string[];
  totalUnexcused: number;
  letterDate: string;
  preparedBy: string;
}

/* ------------------------------------------------------------------ */
/* Colors (matching report palette)                                    */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
const C = {
  navy: [30, 41, 59] as RGB,
  body: [71, 85, 105] as RGB,
  light: [148, 163, 184] as RGB,
  emerald: [5, 150, 105] as RGB,
  grayBorder: [226, 232, 240] as RGB,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

export function generateTruancyNotificationLetter(input: TruancyLetterInput): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const ML = 72; // 1-inch margins
  const MR = 72;
  const CW = W - ML - MR; // 468pt content width

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  let y = 72; // start at 1-inch from top

  // --- District letterhead ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(C.navy);
  doc.text(input.district.name, ML, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(C.body);
  const districtLines = input.district.address.split("\n");
  for (const line of districtLines) {
    doc.text(line, ML, y);
    y += 13;
  }
  y += 8;

  // Emerald line
  setDraw(C.emerald);
  doc.setLineWidth(1.5);
  doc.line(ML, y, W - MR, y);
  y += 28;

  // --- Date ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setColor(C.body);
  doc.text(fmtDate(input.letterDate), ML, y);
  y += 28;

  // --- Recipient ---
  const parentLines = [input.parent.name, ...input.parent.address.split("\n")];
  for (const line of parentLines) {
    doc.text(line, ML, y);
    y += 15;
  }
  y += 20;

  // --- RE line ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(C.navy);
  doc.text(
    `RE: Notice of Truancy — ${input.student.firstName} ${input.student.lastName}, Grade ${input.student.grade}`,
    ML,
    y
  );
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setColor(C.body);
  doc.text(`      ${input.school.name}`, ML, y);
  y += 24;

  // --- Salutation ---
  doc.text(`Dear ${input.parent.name},`, ML, y);
  y += 22;

  // --- Body paragraphs ---
  const lineSpacing = 16.5; // ~1.5 line spacing at 11pt

  const para1 = wrapText(
    doc,
    `This letter is to inform you that ${input.student.firstName} ${input.student.lastName} has been reported as truant pursuant to California Education Code Section 48260. Your child has accumulated ${input.totalUnexcused} unexcused absence${input.totalUnexcused !== 1 ? "s" : ""} on the following dates:`,
    CW
  );
  for (const line of para1) {
    doc.text(line, ML, y);
    y += lineSpacing;
  }
  y += 8;

  // Absence dates list
  if (input.absenceDates.length > 0) {
    doc.setFont("helvetica", "bold");
    for (const dateStr of input.absenceDates) {
      doc.text(`    •  ${fmtDate(dateStr)}`, ML, y);
      y += 15;

      // Page overflow check
      if (y > H - 120) {
        addFooter(doc, ML, MR, W, H, input.student, input.district);
        doc.addPage();
        y = 72;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        setColor(C.body);
      }
    }
    doc.setFont("helvetica", "normal");
  } else {
    // Fallback: no specific dates available
    doc.setFont("helvetica", "italic");
    doc.text(`    (${input.totalUnexcused} unexcused absence${input.totalUnexcused !== 1 ? "s" : ""} on record — see attached attendance report for details)`, ML, y);
    doc.setFont("helvetica", "normal");
    y += 15;
  }
  y += 10;

  // Paragraph: definition of truancy
  const para2 = wrapText(
    doc,
    "Under California law (EC §48260), a student is considered truant after three or more absences or tardies of more than 30 minutes without a valid excuse in one school year.",
    CW
  );
  for (const line of para2) {
    doc.text(line, ML, y);
    y += lineSpacing;
  }
  y += 10;

  // Paragraph: parental duty
  const para3 = wrapText(
    doc,
    "As the parent or guardian, you are required by law to compel the attendance of your child at school (EC §48200). Please be advised of the following:",
    CW
  );
  for (const line of para3) {
    doc.text(line, ML, y);
    y += lineSpacing;
  }
  y += 10;

  // Numbered list
  const items = [
    "You have the right to meet with appropriate school personnel to discuss solutions to your child's truancy (EC §48260.5).",
    "Continued truancy may result in further action, including a second truancy report, a parent conference, referral to the School Attendance Review Board (SARB), and/or referral to the District Attorney (EC §48263-48263.5).",
    "Under EC §48293, a parent or guardian who fails to compel the attendance of their child may be subject to a fine.",
  ];

  for (let i = 0; i < items.length; i++) {
    const numbered = `${i + 1}. ${items[i]}`;
    const lines = wrapText(doc, numbered, CW - 20);
    for (let j = 0; j < lines.length; j++) {
      // Page overflow check
      if (y > H - 100) {
        addFooter(doc, ML, MR, W, H, input.student, input.district);
        doc.addPage();
        y = 72;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        setColor(C.body);
      }
      doc.text(lines[j], ML + (j === 0 ? 0 : 16), y);
      y += lineSpacing;
    }
    y += 4;
  }
  y += 10;

  // Closing paragraph
  const formattedPhone = input.school.phone ? formatPhoneNumber(input.school.phone) : "";
  const closing = wrapText(
    doc,
    `We are committed to supporting ${input.student.firstName}'s success and want to work together to improve attendance. Please contact ${input.school.name}${formattedPhone ? ` at ${formattedPhone}` : ""} to schedule a meeting at your earliest convenience.`,
    CW
  );
  for (const line of closing) {
    if (y > H - 100) {
      addFooter(doc, ML, MR, W, H, input.student, input.district);
      doc.addPage();
      y = 72;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      setColor(C.body);
    }
    doc.text(line, ML, y);
    y += lineSpacing;
  }
  y += 30;

  // Signature block
  doc.text("Sincerely,", ML, y);
  y += 36;

  doc.setFont("helvetica", "bold");
  doc.text(input.preparedBy, ML, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.text(input.school.name, ML, y);
  y += 15;
  doc.text(input.district.name, ML, y);
  y += 28;

  // CC line
  doc.setFontSize(9);
  setColor(C.light);
  doc.text("cc: Student cumulative file", ML, y);

  // Footer
  addFooter(doc, ML, MR, W, H, input.student, input.district);

  return doc.output("blob");
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function addFooter(
  doc: jsPDF,
  ML: number,
  MR: number,
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
    `${district.name} — Truancy Notification — ${student.firstName} ${student.lastName}`,
    W / 2,
    fy,
    { align: "center" }
  );
}
