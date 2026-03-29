import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

interface AggregateMetrics {
  schoolName: string;
  totalStudents: number;
  chronicCount: number;
  chronicRate: number;
  elevatedCount: number;
  softeningCount: number;
  stableCount: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  overdueCount: number;
  oldestOverdueDays: number;
  projectedLoss: number;
  dayNumber: number;
  totalDays: number;
}

interface FlaggedStudent {
  firstName: string;
  lastName: string;
  reason: string;
  detail: string;
}

interface SchoolMetrics {
  aggregate: AggregateMetrics;
  studentsFlagged: FlaggedStudent[];
}

/* ================================================================== */
/* Anthropic API helper (from generate-insights pattern)               */
/* ================================================================== */

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        // Don't retry billing or auth errors
        if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403
        ) {
          try {
            const parsed = JSON.parse(errBody);
            throw new Error(parsed?.error?.message ?? errBody);
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) throw new Error(errBody);
            throw parseErr;
          }
        }
        if (response.status === 429) {
          throw new Error("rate_limit");
        }
        throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
      }

      const json = await response.json();
      return json.content?.[0]?.text ?? "";
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 2) throw new Error(msg);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Anthropic call failed after 3 attempts");
}

/* ================================================================== */
/* System prompt                                                       */
/* ================================================================== */

const SYSTEM_PROMPT = `You are the Edvera Attendance Intelligence Agent. You generate concise daily attendance briefs for school principals and attendance coordinators in California school districts.

Your brief should:
- Lead with the most urgent item (new chronic students, overdue actions, rapid declines)
- Be specific with numbers — use exact counts, rates, and dollar amounts
- Reference California Education Code where compliance deadlines are relevant
- Include exactly one funding impact statement
- End with 1-2 specific recommended actions for today
- Be warm but direct — this is read at 6am with coffee
- Stay under 400 words
- Use short paragraphs, no bullet points
- Do not use headers or formatting — this is plain text
- Do not start paragraphs with the same word consecutively

California compliance context:
- EC §48260: Truant after 3 unexcused absences or tardies >30min
- EC §48262: Second truancy report triggers additional intervention
- EC §48263: Third report = habitual truant, SARB referral required
- EC §60901(c)(1): Chronic absence = 10%+ of enrolled days
- Each absent day = ~$65 in lost ADA funding

Write as if you are a knowledgeable colleague briefing the principal.
Do not say "I" or refer to yourself. Do not start with "Good morning" or any greeting — the consuming application handles that.`;

/* ================================================================== */
/* Gather metrics for one school                                       */
/* ================================================================== */

async function gatherSchoolMetrics(
  supabase: ReturnType<typeof createClient>,
  schoolId: string,
  schoolName: string,
  today: string
): Promise<SchoolMetrics> {
  const DAILY_RATE = 65;

  // Run all queries in parallel
  const [
    { count: studentCount },
    { data: snapshots },
    { data: signals },
    { data: cases },
    { data: overdueActions },
    { data: elevatedStudents },
    { data: calendarDays },
  ] = await Promise.all([
    // a) Student count
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_active", true),

    // b) Attendance snapshots for chronic absence
    supabase
      .from("attendance_snapshots")
      .select("is_chronic_absent, days_absent, days_enrolled, attendance_rate")
      .eq("school_id", schoolId),

    // c) Risk signal distribution
    supabase
      .from("risk_signals")
      .select("signal_level")
      .eq("school_id", schoolId),

    // d) Open compliance cases by tier
    supabase
      .from("compliance_cases")
      .select("current_tier")
      .eq("school_id", schoolId)
      .eq("is_resolved", false),

    // e) Overdue actions with student names (stored in DB, NOT sent to AI)
    supabase
      .from("actions")
      .select("title, due_date, students!inner(first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("status", "open")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5),

    // f) Elevated risk students with names (stored in DB, NOT sent to AI)
    supabase
      .from("risk_signals")
      .select(
        "signal_title, attendance_rate, students!inner(first_name, last_name)"
      )
      .eq("school_id", schoolId)
      .eq("signal_level", "elevated")
      .order("attendance_rate", { ascending: true })
      .limit(5),

    // g) School calendar days for day count
    supabase
      .from("school_calendars")
      .select("calendar_date")
      .eq("school_id", schoolId)
      .eq("is_school_day", true)
      .lte("calendar_date", today),
  ]);

  const snapList = snapshots ?? [];
  const signalList = signals ?? [];
  const caseList = cases ?? [];

  // Chronic absence
  const chronicStudents = snapList.filter((s) => s.is_chronic_absent);
  const total = studentCount ?? 0;
  const chronicRate =
    total > 0 ? (chronicStudents.length / total) * 100 : 0;

  // Risk signals by level
  const elevatedCount = signalList.filter(
    (s) => s.signal_level === "elevated"
  ).length;
  const softeningCount = signalList.filter(
    (s) => s.signal_level === "softening"
  ).length;
  const stableCount = signalList.filter(
    (s) => s.signal_level === "stable"
  ).length;

  // Compliance by tier
  const tier1Count = caseList.filter(
    (c) => c.current_tier === "tier_1_letter"
  ).length;
  const tier2Count = caseList.filter(
    (c) => c.current_tier === "tier_2_conference"
  ).length;
  const tier3Count = caseList.filter(
    (c) => c.current_tier === "tier_3_sarb_referral"
  ).length;

  // Overdue actions
  const overdueList = overdueActions ?? [];
  const overdueCount = overdueList.length;
  let oldestOverdueDays = 0;
  if (overdueList.length > 0) {
    const oldest = overdueList[0]?.due_date;
    if (oldest) {
      const diff = Date.now() - new Date(oldest).getTime();
      oldestOverdueDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    }
  }

  // Projected ADA loss (chronic students only)
  const projectedLoss = chronicStudents.reduce(
    (sum, s) => sum + (s.days_absent ?? 0) * DAILY_RATE,
    0
  );

  // Day of school year
  const dayNumber = calendarDays?.length ?? 0;
  const totalDays = 180; // CA standard

  // Build flagged students list (stored in DB, NOT sent to AI)
  const flagged: FlaggedStudent[] = [];

  for (const a of overdueList) {
    const s = (a as Record<string, unknown>).students as
      | { first_name?: string; last_name?: string }
      | undefined;
    const dueDiff = Date.now() - new Date(a.due_date).getTime();
    const overdueDays = Math.max(
      0,
      Math.floor(dueDiff / (1000 * 60 * 60 * 24))
    );
    flagged.push({
      firstName: s?.first_name ?? "",
      lastName: s?.last_name ?? "",
      reason: "overdue_action",
      detail: `${a.title} (${overdueDays} days overdue)`,
    });
  }

  for (const rs of elevatedStudents ?? []) {
    const s = (rs as Record<string, unknown>).students as
      | { first_name?: string; last_name?: string }
      | undefined;
    flagged.push({
      firstName: s?.first_name ?? "",
      lastName: s?.last_name ?? "",
      reason: "elevated_risk",
      detail: `${(Number(rs.attendance_rate) || 0).toFixed(1)}% absence rate — ${rs.signal_title ?? "elevated risk"}`,
    });
  }

  return {
    aggregate: {
      schoolName,
      totalStudents: total,
      chronicCount: chronicStudents.length,
      chronicRate: Math.round(chronicRate * 10) / 10,
      elevatedCount,
      softeningCount,
      stableCount,
      tier1Count,
      tier2Count,
      tier3Count,
      overdueCount,
      oldestOverdueDays,
      projectedLoss: Math.round(projectedLoss),
      dayNumber,
      totalDays,
    },
    studentsFlagged: flagged,
  };
}

/* ================================================================== */
/* Build AI user prompt (aggregate only — NO student names)            */
/* ================================================================== */

function buildUserPrompt(m: AggregateMetrics): string {
  // Classification per Attendance Works
  let classification = "Satisfactory";
  if (m.chronicRate >= 30) classification = "Extreme";
  else if (m.chronicRate >= 20) classification = "High";
  else if (m.chronicRate >= 10) classification = "Significant";
  else if (m.chronicRate >= 5) classification = "Modest";

  // Recovery estimate: if top chronic students improved to 95%
  const recoveryEstimate = Math.round(m.projectedLoss * 0.3);

  return `Generate a daily attendance brief for ${m.schoolName}.

Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
School year day: ${m.dayNumber} of ${m.totalDays}

Current metrics:
- Total students: ${m.totalStudents}
- Chronically absent students: ${m.chronicCount} (${m.chronicRate}%)
- Attendance Works classification: ${classification}

Risk signals:
- Elevated: ${m.elevatedCount}
- Softening: ${m.softeningCount}
- Stable: ${m.stableCount}

Compliance:
- Tier 1 (Letter) open cases: ${m.tier1Count}
- Tier 2 (Conference) open cases: ${m.tier2Count}
- Tier 3 (SARB) open cases: ${m.tier3Count}
- Overdue actions: ${m.overdueCount}${m.oldestOverdueDays > 0 ? ` (oldest: ${m.oldestOverdueDays} days past due)` : ""}

Funding:
- Projected ADA loss from chronic absence: $${m.projectedLoss.toLocaleString()}
- Potential recovery if top students improve to 95%: $${recoveryEstimate.toLocaleString()}

Generate the brief body text only.`;
}

/* ================================================================== */
/* Attendance Works classification helper                              */
/* ================================================================== */

function attendanceWorksClassification(chronicRate: number): string {
  if (chronicRate >= 30) return "Extreme";
  if (chronicRate >= 20) return "High";
  if (chronicRate >= 10) return "Significant";
  if (chronicRate >= 5) return "Modest";
  return "Satisfactory";
}

/* ================================================================== */
/* GET handler — return latest briefs                                  */
/* ================================================================== */

async function handleGet(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const url = new URL(req.url);
  const schoolId = url.searchParams.get("school_id");

  let query = supabase
    .from("briefs")
    .select("*")
    .order("brief_date", { ascending: false })
    .limit(10);

  if (schoolId) {
    query = query.eq("school_id", schoolId);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, briefs: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ================================================================== */
/* POST handler — generate new briefs                                  */
/* ================================================================== */

async function handlePost(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string
): Promise<Response> {
  const startTime = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // Get all schools
  const { data: schools, error: schoolsErr } = await supabase
    .from("schools")
    .select("id, name, district_id");

  if (schoolsErr || !schools?.length) {
    return new Response(
      JSON.stringify({ error: schoolsErr?.message ?? "No schools found" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Determine district_id from the first school
  const districtId = schools[0]?.district_id ?? null;

  // Create agent_runs record
  const { data: run, error: runErr } = await supabase
    .from("agent_runs")
    .insert({
      run_type: "daily_brief",
      district_id: districtId,
      started_at: startTime,
      status: "running",
    })
    .select("id")
    .single();

  if (runErr) {
    console.error("Failed to create agent_runs record:", runErr);
  }

  let schoolsProcessed = 0;
  let briefsGenerated = 0;
  const schoolResults: Record<string, unknown>[] = [];
  const generatedBriefs: Record<string, unknown>[] = [];

  for (const school of schools) {
    try {
      // Gather metrics (aggregate + flagged students)
      const metrics = await gatherSchoolMetrics(
        supabase,
        school.id,
        school.name,
        today
      );

      // Generate AI narrative (aggregate only — NO student names)
      const narrative = await callAnthropic(
        anthropicKey,
        SYSTEM_PROMPT,
        buildUserPrompt(metrics.aggregate)
      );

      // Store brief in database
      const briefRow = {
        school_id: school.id,
        district_id: school.district_id,
        brief_date: today,
        narrative,
        metrics_snapshot: metrics.aggregate,
        students_flagged: metrics.studentsFlagged,
        generated_at: new Date().toISOString(),
        run_id: run?.id ?? null,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("briefs")
        .insert(briefRow)
        .select("id")
        .single();

      if (insertErr) {
        console.error(`Failed to store brief for ${school.name}:`, insertErr);
        schoolResults.push({
          school_id: school.id,
          school_name: school.name,
          error: insertErr.message,
        });
        continue;
      }

      briefsGenerated++;
      schoolsProcessed++;

      const result = {
        id: inserted?.id,
        school_id: school.id,
        school_name: school.name,
        brief_date: today,
        classification: attendanceWorksClassification(
          metrics.aggregate.chronicRate
        ),
        narrative,
        metrics_snapshot: metrics.aggregate,
        students_flagged: metrics.studentsFlagged,
      };

      schoolResults.push(result);
      generatedBriefs.push(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error processing school ${school.name}:`, msg);
      schoolResults.push({
        school_id: school.id,
        school_name: school.name,
        error: msg,
      });
    }
  }

  // Update agent_runs record
  if (run?.id) {
    await supabase
      .from("agent_runs")
      .update({
        schools_processed: schoolsProcessed,
        briefs_sent: briefsGenerated,
        completed_at: new Date().toISOString(),
        status: "completed",
        metadata: { school_results: schoolResults },
      })
      .eq("id", run.id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      schools_processed: schoolsProcessed,
      briefs_generated: briefsGenerated,
      briefs: generatedBriefs,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/* ================================================================== */
/* Serve                                                               */
/* ================================================================== */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — Supabase relay validates JWT; we just verify header exists
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create service-role Supabase client (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET: return latest briefs
    if (req.method === "GET") {
      return handleGet(req, supabase);
    }

    // POST: generate new briefs
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return handlePost(supabase, anthropicKey);
  } catch (e: unknown) {
    console.error("daily-brief error:", e);

    // Try to mark any running run as failed
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          error_message: e instanceof Error ? e.message : String(e),
          completed_at: new Date().toISOString(),
        })
        .eq("status", "running");
    } catch {
      /* best effort */
    }

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
