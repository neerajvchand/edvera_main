import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ------------------------------------------------------------------ */
/* Anthropic API helper                                                */
/* ------------------------------------------------------------------ */
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
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          // Try to extract a cleaner message from the Anthropic JSON error
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

/* ------------------------------------------------------------------ */
/* JSON extraction (handles markdown fences, preamble)                 */
/* ------------------------------------------------------------------ */
function extractJSONArray(text: string): unknown[] {
  // Try markdown fence first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Find the outermost array
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
  }

  // Last resort: try parsing the whole thing
  return JSON.parse(cleaned);
}

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */
const SYSTEM_PROMPT = `You are an attendance analytics assistant for Edvera, a school district attendance operations platform. You analyze attendance data and produce concise, actionable insights for district administrators.

Your role:
- Identify the most important patterns, risks, and opportunities in the data
- Be specific — use actual numbers, school names, and percentages
- Focus on what's actionable — what should the administrator DO about this
- Connect attendance to funding impact where relevant
- Reference California Education Code where compliance is involved
- Be concise — each insight should be 1-2 sentences maximum
- Never be generic — every insight must reference specific data points from this district

Respond with a JSON array of insight objects. Each object has:
- "category": one of "declining", "improving", "warning", "recommendation", "funding"
- "text": the insight text (1-2 sentences, specific numbers)
- "link": optional, one of "/students", "/compliance", "/actions", "/funding"
- "priority": 1-5 (1 = most important)

Return 4-6 insights, sorted by priority. Do not include any text outside the JSON array.`;

/* ------------------------------------------------------------------ */
/* Build user prompt from metrics                                      */
/* ------------------------------------------------------------------ */
function fmt(n: unknown, decimals = 0): string {
  if (typeof n !== "number" || isNaN(n)) return "0";
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

function buildUserPrompt(metrics: Record<string, unknown>): string {
  const m = metrics as {
    totalStudents: number;
    chronicAbsenceRate: number;
    chronicAbsenceCount: number;
    projectedAdaLoss: number;
    elevatedStudents: number;
    softeningStudents: number;
    stableStudents: number;
    complianceCasesOpen: number;
    tier1Cases: number;
    tier2Cases: number;
    tier3Cases: number;
    overdueActions: number;
    schoolBreakdown: {
      name: string;
      students: number;
      chronicRate: number;
      adaLoss: number;
      elevated: number;
      classification: string;
    }[];
  };

  const schoolLines = (m.schoolBreakdown ?? [])
    .map(
      (s) =>
        `- ${s.name ?? "Unknown"}: ${fmt(s.students)} students, ${fmt(s.chronicRate, 1)}% chronic rate (${s.classification ?? "N/A"}), $${fmt(s.adaLoss)} projected loss, ${fmt(s.elevated)} elevated`
    )
    .join("\n");

  return `Analyze this district attendance data and generate insights:

District Summary:
- Total students: ${fmt(m.totalStudents)}
- Chronic absence rate: ${fmt(m.chronicAbsenceRate, 1)}%
- Chronically absent students: ${fmt(m.chronicAbsenceCount)}
- Total projected ADA loss: $${fmt(m.projectedAdaLoss)}

Schools:
${schoolLines}

Risk Signals:
- Elevated: ${m.elevatedStudents} students
- Softening: ${m.softeningStudents} students
- Stable: ${m.stableStudents} students

Compliance:
- Tier 1 (Notification) open cases: ${m.tier1Cases}
- Tier 2 (Conference) open cases: ${m.tier2Cases}
- Tier 3 (SARB Referral) open cases: ${m.tier3Cases}
- Total open compliance cases: ${m.complianceCasesOpen}
- Overdue actions: ${m.overdueActions}

Generate specific, actionable insights for the district administrator.`;
}

/* ------------------------------------------------------------------ */
/* Serve                                                               */
/* ------------------------------------------------------------------ */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — Supabase relay already validates the JWT, so we just
    // verify an Authorization header was forwarded (matches csv-analysis pattern).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { metrics } = await req.json();
    if (!metrics) {
      return new Response(
        JSON.stringify({ error: "metrics object required in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = buildUserPrompt(metrics);
    const rawResponse = await callAnthropic(apiKey, SYSTEM_PROMPT, userPrompt);
    const insights = extractJSONArray(rawResponse);

    return new Response(
      JSON.stringify({ success: true, insights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
