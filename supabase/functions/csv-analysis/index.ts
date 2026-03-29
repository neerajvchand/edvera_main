import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." });
        }
        if (response.status === 402) {
          return JSON.stringify({ error: "AI usage limit reached. Please add credits." });
        }
        throw new Error(`AI error ${response.status}`);
      }

      const json = await response.json();
      return json.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("AI call failed");
}

function extractJSON(text: string): any {
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) return JSON.parse(fenceMatch[1].trim());
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return JSON.parse(objMatch[0]);
  return JSON.parse(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, action, params } = await req.json();
    if (!document_id || !action) {
      return new Response(
        JSON.stringify({ error: "document_id and action required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify access
    const { data: doc, error: docErr } = await userClient
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get CSV profile from chunks
    const { data: chunks } = await supabaseAdmin
      .from("document_chunks")
      .select("*")
      .eq("document_id", document_id)
      .order("chunk_index", { ascending: true });

    let csvProfile: any = null;
    let csvHeaders: string[] = [];
    let csvSample: string[][] = [];

    if (chunks?.length) {
      try {
        const parsed = JSON.parse(chunks[0].text);
        csvProfile = parsed.profile;
        csvHeaders = parsed.headers || [];
        csvSample = (parsed.rows || []).slice(0, 15);
      } catch { /* not csv data */ }
    }

    if (!csvProfile) {
      return new Response(
        JSON.stringify({ error: "No CSV profile found for this document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing outputs for context
    const { data: outputs } = await supabaseAdmin
      .from("document_outputs")
      .select("*")
      .eq("document_id", document_id)
      .maybeSingle();

    const dataContext = `CSV Profile:\n${JSON.stringify(csvProfile, null, 2)}\n\nHeaders: ${csvHeaders.join(", ")}\n\nSample rows (first 15):\n${csvSample.map(r => r.join(", ")).join("\n")}`;

    const strictRule = doc.strict_mode
      ? "\n\nSTRICT EVIDENCE MODE: Every claim MUST reference a specific column_name and computed_metric from the profile. Do NOT invent numbers. If data is insufficient, say so explicitly."
      : "";

    let result: any;

    switch (action) {
      case "decision_assistant": {
        const subAction = params?.sub_action || "outliers";
        const prompts: Record<string, string> = {
          outliers: `Identify statistical outliers and anomalies in this dataset. For each outlier, specify the column, the value, why it's an outlier (e.g., >2 standard deviations from mean), and the operational implication.${strictRule}`,
          compare: `Compare entities/categories in this dataset. Identify which columns represent entities and compare their performance metrics. Highlight gaps and relative standings.${strictRule}`,
          risk_indicators: `Identify risk indicators in this data. Look for: missing data patterns suggesting systemic issues, values outside acceptable ranges, declining trends, and compliance gaps.${strictRule}`,
          data_quality: `Assess data quality issues. For each column, evaluate: completeness (missing %), consistency (type mismatches), accuracy (out-of-range values), and timeliness. Provide a data quality score.${strictRule}`,
          priorities: `Based on this data, suggest operational priorities for school administration. Rank by urgency and impact. Each priority must be backed by specific metrics from the data.${strictRule}`,
        };

        const prompt = prompts[subAction] || prompts.outliers;

        const aiResult = await callAI(
          apiKey,
          "You are a school operations data analyst. Output ONLY valid JSON. Every finding must reference specific column names and computed metrics.",
          `${prompt}\n\nReturn JSON:\n{\n  "findings": [\n    {\n      "title": "string",\n      "description": "string",\n      "severity": "low|medium|high",\n      "evidence": {\n        "column": "string",\n        "metric": "string",\n        "value": "string"\n      }\n    }\n  ],\n  "summary": "string"\n}\n\n${dataContext}`
        );

        result = extractJSON(aiResult);
        break;
      }

      case "board_brief": {
        const aiResult = await callAI(
          apiKey,
          `You generate concise board briefs for school district leadership. Output ONLY valid JSON. Every insight must reference specific data points.${strictRule}`,
          `Generate a board brief from this CSV data analysis.\n\nReturn JSON:\n{\n  "insights": [\n    { "title": "string", "detail": "string", "metric_reference": "string" }\n  ],\n  "risks": [\n    { "title": "string", "detail": "string", "severity": "low|medium|high", "metric_reference": "string" }\n  ],\n  "recommendation": {\n    "title": "string",\n    "detail": "string",\n    "rationale": "string"\n  },\n  "executive_summary": "string",\n  "chart_suggestion": {\n    "type": "bar|scatter|distribution",\n    "x_column": "string",\n    "y_column": "string",\n    "title": "string"\n  }\n}\n\nProvide exactly 3 insights and 2 risks.\n\n${dataContext}\n\nExisting analysis:\n${JSON.stringify(outputs?.action_items_json || [])}\n${JSON.stringify(outputs?.risks_json || [])}`
        );

        result = extractJSON(aiResult);
        break;
      }

      case "communication_draft": {
        const audience = params?.audience || "principal";
        const tone = params?.tone || "formal";

        const audienceContexts: Record<string, string> = {
          principal: "a school principal who needs actionable data insights for school improvement",
          staff: "school staff members who need to understand data trends affecting their work",
          district: "district leadership who need high-level strategic data insights",
          board: "school board members who need concise data summaries for governance decisions",
        };

        const toneGuides: Record<string, string> = {
          formal: "Use formal, professional language appropriate for official correspondence.",
          informational: "Use clear, accessible language that explains data findings simply.",
          strategic: "Use strategic, action-oriented language focusing on implications and next steps.",
        };

        const aiResult = await callAI(
          apiKey,
          `You draft professional communications for school administration. ${toneGuides[tone] || toneGuides.formal}${strictRule}`,
          `Draft an email for ${audienceContexts[audience] || audienceContexts.principal}.\n\nReturn JSON:\n{\n  "subject": "string",\n  "body": "string (use \\n for line breaks)",\n  "key_data_points": [\n    { "metric": "string", "value": "string", "column": "string" }\n  ]\n}\n\nThe email must reference actual metrics from the CSV data only.\n\n${dataContext}\n\nExisting analysis:\n${JSON.stringify(outputs?.action_items_json || [])}\n${JSON.stringify(outputs?.risks_json || [])}`
        );

        result = extractJSON(aiResult);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("csv-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
