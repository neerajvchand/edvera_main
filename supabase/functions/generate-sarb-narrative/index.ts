/**
 * Supabase Edge Function: generate-sarb-narrative
 *
 * Generates an AI-drafted SARB narrative summary for a compliance case.
 * The narrative follows a structured format referencing California Ed Code
 * and is meant as a starting point for staff to refine.
 *
 * POST body: { compliance_case_id: string, student_id: string }
 * Returns: { narrative: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { compliance_case_id, student_id } = await req.json();

    if (!compliance_case_id || !student_id) {
      return new Response(
        JSON.stringify({ error: "compliance_case_id and student_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all needed data in parallel
    const [
      { data: student },
      { data: caseData },
      { data: actions },
      { data: documents },
      { data: snapshot },
    ] = await Promise.all([
      sb
        .from("students")
        .select("first_name, last_name, grade_level, birth_date, home_language_code, language_fluency, ssid")
        .eq("id", student_id)
        .single(),
      sb
        .from("compliance_cases")
        .select(
          `*, schools!compliance_cases_school_id_fkey(name),
           students!compliance_cases_student_id_fkey(first_name, last_name)`
        )
        .eq("id", compliance_case_id)
        .single(),
      sb
        .from("actions")
        .select("action_type, title, status, completed_at, completion_data, completion_notes, created_at")
        .eq("compliance_case_id", compliance_case_id)
        .eq("status", "completed")
        .order("completed_at", { ascending: true }),
      sb
        .from("compliance_documents")
        .select("doc_type, title, created_at")
        .eq("case_id", compliance_case_id)
        .order("created_at", { ascending: true }),
      sb
        .from("attendance_snapshots")
        .select("days_enrolled, days_present, days_absent, days_absent_excused, days_absent_unexcused, attendance_rate, is_chronic_absent, truancy_count")
        .eq("student_id", student_id)
        .eq("academic_year", caseData?.academic_year ?? "2025-2026")
        .single(),
    ]);

    if (!caseData || !student) {
      return new Response(
        JSON.stringify({ error: "Case or student not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const school = caseData.schools as { name: string } | null;
    const rootCause = (caseData.root_cause_data as Record<string, unknown>) ?? {};
    const tierReqs = (caseData.tier_requirements as Record<string, unknown>) ?? {};

    // Build context for the AI
    const studentName = `${student.first_name} ${student.last_name}`;
    const grade = student.grade_level ?? "Unknown";
    const snap = snapshot ?? {
      days_enrolled: 0,
      days_present: 0,
      days_absent: 0,
      days_absent_excused: 0,
      days_absent_unexcused: 0,
      attendance_rate: 0,
      is_chronic_absent: false,
      truancy_count: 0,
    };

    const completedActions = (actions ?? []).map((a: Record<string, unknown>) => {
      const cd = a.completion_data as Record<string, unknown> | null;
      return {
        type: (a.action_type as string).replace(/_/g, " "),
        title: a.title,
        completedAt: a.completed_at ? (a.completed_at as string).slice(0, 10) : "unknown",
        notes: a.completion_notes ?? "",
        details: cd ? JSON.stringify(cd) : "",
      };
    });

    const docs = (documents ?? []).map((d: Record<string, unknown>) => ({
      type: (d.doc_type as string).replace(/_/g, " "),
      title: d.title,
      date: d.created_at ? (d.created_at as string).slice(0, 10) : "",
    }));

    // Format root cause summary
    const rootCauseSummary: string[] = [];
    for (const [domain, data] of Object.entries(rootCause)) {
      const d = data as { questions?: Record<string, string>; notes?: string };
      if (!d.questions) continue;
      const yesItems = Object.entries(d.questions)
        .filter(([, v]) => v === "yes")
        .map(([k]) => k.replace(/_/g, " "));
      if (yesItems.length > 0) {
        rootCauseSummary.push(`${domain}: ${yesItems.join(", ")}`);
      }
      if (d.notes) {
        rootCauseSummary.push(`${domain} notes: ${d.notes}`);
      }
    }

    // Classification
    let classification = "truant";
    if (snap.is_chronic_absent) classification = "chronically absent and truant";
    if (snap.truancy_count >= 4) classification = "habitual truant";

    const prompt = `You are writing a professional SARB (School Attendance Review Board) narrative summary for a California public school student referral. Write 3-5 paragraphs in formal, factual tone. Do not editorialize or speculate. Reference California Education Code sections where applicable.

STUDENT INFORMATION:
- Name: ${studentName}
- Grade: ${grade}
- School: ${school?.name ?? "Unknown"}
- Case opened: ${caseData.created_at ? (caseData.created_at as string).slice(0, 10) : "Unknown"}
- Current tier: ${(caseData.current_tier as string).replace(/_/g, " ")}
- Classification: ${classification}

ATTENDANCE DATA (Current Year):
- Days enrolled: ${snap.days_enrolled}
- Days present: ${snap.days_present}
- Total absences: ${snap.days_absent}
- Excused absences: ${snap.days_absent_excused ?? 0}
- Unexcused absences: ${snap.days_absent_unexcused ?? 0}
- Attendance rate: ${snap.attendance_rate}%
- Truancy event count: ${snap.truancy_count ?? caseData.truancy_count ?? 0}
- Chronic absent: ${snap.is_chronic_absent ? "Yes" : "No"}

ROOT CAUSE FACTORS IDENTIFIED:
${rootCauseSummary.length > 0 ? rootCauseSummary.join("\n") : "No root cause analysis completed yet."}

COMPLETED INTERVENTIONS (chronological):
${completedActions.length > 0 ? completedActions.map((a) => `- ${a.completedAt}: ${a.type} — ${a.title}${a.notes ? ` (${a.notes})` : ""}`).join("\n") : "No completed interventions on record."}

COMPLIANCE DOCUMENTS GENERATED:
${docs.length > 0 ? docs.map((d) => `- ${d.date}: ${d.type} — ${d.title}`).join("\n") : "No documents generated."}

Write the narrative with these sections:
1. Student overview paragraph (grade, school, enrollment context)
2. Attendance summary paragraph (cite EC §48260 for truancy definition, §48262 for habitual truant if applicable)
3. Root cause factors paragraph (if data available)
4. Interventions attempted paragraph (chronological, with dates)
5. Parent/guardian engagement history and reason for SARB escalation paragraph (cite EC §48263)

Do not include headers or section labels — write as continuous paragraphs.`;

    let narrative: string;

    if (anthropicApiKey) {
      // Call Anthropic API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Anthropic API error:", errText);
        // Fall back to template narrative
        narrative = generateTemplateNarrative(studentName, grade, school?.name ?? "", snap, completedActions, classification, caseData);
      } else {
        const result = await response.json();
        narrative = result.content?.[0]?.text ?? generateTemplateNarrative(studentName, grade, school?.name ?? "", snap, completedActions, classification, caseData);
      }
    } else {
      // No API key — use template narrative
      narrative = generateTemplateNarrative(studentName, grade, school?.name ?? "", snap, completedActions, classification, caseData);
    }

    // Save to sarb_packets if one exists
    const { data: existingPacket } = await sb
      .from("sarb_packets")
      .select("id")
      .eq("compliance_case_id", compliance_case_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingPacket) {
      await sb
        .from("sarb_packets")
        .update({ narrative_summary: narrative, updated_at: new Date().toISOString() })
        .eq("id", existingPacket.id);
    }

    return new Response(
      JSON.stringify({ narrative }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-sarb-narrative error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Template-based narrative fallback when Anthropic API is unavailable.
 */
function generateTemplateNarrative(
  studentName: string,
  grade: string,
  schoolName: string,
  snap: Record<string, unknown>,
  actions: { completedAt: string; type: string; title: string; notes: string }[],
  classification: string,
  caseData: Record<string, unknown>
): string {
  const caseOpened = caseData.created_at ? (caseData.created_at as string).slice(0, 10) : "the current school year";
  const attendanceRate = snap.attendance_rate ?? 0;
  const totalAbsences = snap.days_absent ?? 0;
  const unexcused = snap.days_absent_unexcused ?? 0;

  const para1 = `${studentName} is a ${grade} grade student at ${schoolName}. A compliance case was opened on ${caseOpened} due to a pattern of excessive absences. The student has been classified as ${classification} under California Education Code Section 48260.`;

  const para2 = `As of the current reporting period, ${studentName} has been enrolled for ${snap.days_enrolled ?? 0} school days with an attendance rate of ${attendanceRate}%. The student has accumulated ${totalAbsences} total absences, of which ${unexcused} are unexcused. Under EC §48260, a student is considered truant after three or more unexcused absences or tardies exceeding 30 minutes in a school year.`;

  let para3 = "";
  if (actions.length > 0) {
    const actionList = actions
      .map((a) => `${a.type} on ${a.completedAt}`)
      .join("; ");
    para3 = `The school has attempted the following interventions: ${actionList}. Despite these efforts, the student's attendance has not sufficiently improved.`;
  } else {
    para3 = "The school has documented ongoing efforts to address the student's attendance, including required notifications and outreach.";
  }

  const para4 = `Pursuant to EC §48263, the school is referring this case to the School Attendance Review Board for further intervention and support. All required Tier 1 (notification) and Tier 2 (conference) interventions have been completed as documented in the attached compliance records.`;

  return [para1, para2, para3, para4].join("\n\n");
}
