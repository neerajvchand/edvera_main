import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { insight_key, school_id, question_key } = await req.json();

    if (!insight_key || !school_id || !question_key) {
      return new Response(JSON.stringify({ error: "Missing required fields: insight_key, school_id, question_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch insight by key using service role
    const insightResp = await fetch(
      `${supabaseUrl}/rest/v1/insights?insight_key=eq.${encodeURIComponent(insight_key)}&select=*&limit=1`,
      { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
    );
    const insights = await insightResp.json();
    const insight = insights?.[0];

    if (!insight) {
      return new Response(JSON.stringify({ error: "Insight not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = insight.payload ?? {};

    // Fetch school name
    const schoolResp = await fetch(
      `${supabaseUrl}/rest/v1/schools?id=eq.${encodeURIComponent(school_id)}&select=name&limit=1`,
      { headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` } }
    );
    const schools = await schoolResp.json();
    const schoolName = schools?.[0]?.name ?? "your school";

    // Build context from payload only
    const contextParts = [
      `School: ${schoolName}`,
      `Category: ${insight.category}`,
      `Headline: ${insight.headline}`,
      `Context: ${insight.context}`,
    ];
    if (payload.primary_metric) {
      contextParts.push(`Primary metric: ${payload.primary_metric.value}${payload.primary_metric.unit === "percent" ? "%" : ""} ${payload.primary_metric.label}`);
      if (payload.primary_metric.delta != null) {
        contextParts.push(`Change: +${payload.primary_metric.delta} ${payload.primary_metric.delta_unit ?? ""} from last year`);
      }
    }
    if (payload.comparison) {
      contextParts.push(`Comparison: ${payload.comparison.value}${payload.comparison.unit === "percent" ? "%" : ""} (${payload.comparison.label})`);
    }
    if (payload.meaning_bullets?.length) {
      contextParts.push(`Key facts: ${payload.meaning_bullets.join(" | ")}`);
    }
    if (payload.parent_actions?.length) {
      contextParts.push(`Recommended actions: ${payload.parent_actions.join(" | ")}`);
    }
    if (payload.checklist_items?.length) {
      contextParts.push(`Checklist: ${payload.checklist_items.map((c: any) => `${c.label} (${c.status})`).join(", ")}`);
    }

    const systemPrompt = `You are a calm, helpful school data assistant for parents at ${schoolName}.
Answer ONLY using the provided context — do not add external facts.
Never use alarming language. If data is suppressed, say "Not available for privacy reasons."
Source: ${insight.source}

Context:
${contextParts.join("\n")}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question_key },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "format_answer",
              description: "Return a structured answer to the parent's question about a school insight.",
              parameters: {
                type: "object",
                properties: {
                  answer_title: {
                    type: "string",
                    description: "A short, reassuring title summarizing the answer (max 10 words)",
                  },
                  answer_bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 concise bullet points answering the question using only the provided data",
                  },
                  suggested_next_steps: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-3 actionable next steps the parent can take",
                  },
                },
                required: ["answer_title", "answer_bullets", "suggested_next_steps"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "format_answer" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let structured: any;

    if (toolCall?.function?.arguments) {
      structured = JSON.parse(toolCall.function.arguments);
    } else {
      structured = {
        answer_title: "Here's what we know",
        answer_bullets: [result.choices?.[0]?.message?.content ?? "No answer available."],
        suggested_next_steps: ["Check back later for more details."],
      };
    }

    console.log(JSON.stringify({
      event: "insight_answer",
      insight_key,
      school_id,
      question_key,
      user_id: userData.user.id,
      timestamp: new Date().toISOString(),
    }));

    return new Response(JSON.stringify(structured), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("insights-answer error:", e);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
