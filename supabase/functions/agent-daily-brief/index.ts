/**
 * Supabase Edge Function: agent-daily-brief
 *
 * Secure proxy to the Python Attendance Operations Agent daily-brief endpoint.
 * Validates the caller JWT, verifies active staff_memberships for the requested
 * school (and derives district_id from schools), then forwards to the agent
 * using server-only secrets.
 *
 * Secrets (set in Supabase project):
 *   AGENT_URL       — base URL of the Python agent (no trailing slash)
 *   AGENT_API_KEY   — shared secret; sent as X-Api-Key (maps to API_SECRET_KEY on agent)
 *
 * Standard Edge env: SUPABASE_URL, SUPABASE_ANON_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MembershipRow = {
  school_id: string;
  schools: { district_id: string } | { district_id: string }[] | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function districtFromMembership(row: MembershipRow): string | null {
  const s = row.schools;
  if (!s) return null;
  if (Array.isArray(s)) {
    return s[0]?.district_id ?? null;
  }
  return s.district_id ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const agentUrlRaw = Deno.env.get("AGENT_URL");
  const agentApiKey = Deno.env.get("AGENT_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("agent-daily-brief: missing SUPABASE_URL or SUPABASE_ANON_KEY");
    return jsonResponse({ error: "Server misconfiguration" }, 500);
  }

  if (!agentUrlRaw || !agentApiKey) {
    console.error("agent-daily-brief: missing AGENT_URL or AGENT_API_KEY");
    return jsonResponse(
      { error: "Agent backend is not configured" },
      502,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = userData.user.id;

  let body: { school_id?: string; date?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const schoolId = body.school_id;
  if (!schoolId || typeof schoolId !== "string") {
    return jsonResponse({ error: "Missing or invalid school_id" }, 400);
  }

  const date =
    body.date === undefined || body.date === null
      ? undefined
      : typeof body.date === "string"
        ? body.date
        : undefined;

  const { data: membership, error: memError } = await userClient
    .from("staff_memberships")
    .select("school_id, schools!inner(district_id)")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .maybeSingle();

  if (memError) {
    console.error("agent-daily-brief: membership query error", memError);
    return jsonResponse({ error: "Membership check failed" }, 500);
  }

  if (!membership) {
    return jsonResponse(
      { error: "No active staff membership for this school" },
      403,
    );
  }

  const districtId = districtFromMembership(membership as MembershipRow);
  if (!districtId) {
    return jsonResponse({ error: "Could not resolve district for school" }, 403);
  }

  const agentBase = agentUrlRaw.replace(/\/+$/, "");
  const forwardUrl = `${agentBase}/agent/daily-brief`;

  const forwardBody: Record<string, string | undefined> = {
    user_id: userId,
    district_id: districtId,
    school_id: schoolId,
  };
  if (date !== undefined) forwardBody.date = date;

  let agentRes: Response;
  try {
    agentRes = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": agentApiKey,
      },
      body: JSON.stringify(forwardBody),
    });
  } catch (e) {
    console.error("agent-daily-brief: agent fetch failed", e);
    return jsonResponse(
      { error: "Agent service unreachable" },
      502,
    );
  }

  const text = await agentRes.text();
  let agentJson: unknown;
  try {
    agentJson = text ? JSON.parse(text) : null;
  } catch {
    console.error("agent-daily-brief: agent returned non-JSON", text.slice(0, 200));
    return jsonResponse(
      { error: "Agent returned an invalid response" },
      502,
    );
  }

  if (!agentRes.ok) {
    console.error(
      "agent-daily-brief: agent HTTP error",
      agentRes.status,
      text.slice(0, 500),
    );
    return jsonResponse(
      {
        error: "Agent request failed",
        status: agentRes.status,
        detail: agentJson,
      },
      502,
    );
  }

  return new Response(JSON.stringify(agentJson), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
