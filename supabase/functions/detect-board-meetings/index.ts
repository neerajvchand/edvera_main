import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DistrictSource {
  id: string;
  district_id: string;
  url: string;
  last_hash: string | null;
}

interface DetectedMeeting {
  external_id: string;
  meeting_date: string | null;
  meeting_url: string | null;
}

/** Best-effort extraction of board meeting links from HTML. */
function extractMeetings(html: string, baseUrl: string): DetectedMeeting[] {
  const meetings: DetectedMeeting[] = [];
  const seen = new Set<string>();

  // Match anchor tags whose text or href hints at board meetings / agendas / packets
  const linkRegex =
    /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, "").trim();

    // Filter: only links that look meeting-related
    const combined = (rawHref + " " + linkText).toLowerCase();
    const isMeetingLink =
      /meeting|agenda|minutes|packet|board\s*meeting|regular\s*meeting|special\s*meeting/i.test(
        combined
      );
    if (!isMeetingLink) continue;

    // Build absolute URL
    let meetingUrl: string;
    try {
      meetingUrl = new URL(rawHref, baseUrl).href;
    } catch {
      continue;
    }

    // Derive external_id from URL or link text hash
    const externalId = meetingUrl;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    // Try to parse a date from the link text or URL
    const meetingDate = parseDate(linkText) || parseDate(rawHref);

    meetings.push({
      external_id: externalId,
      meeting_date: meetingDate,
      meeting_url: meetingUrl,
    });
  }

  return meetings;
}

/** Try to extract a date (YYYY-MM-DD) from a string. */
function parseDate(text: string): string | null {
  // YYYY-MM-DD
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Month DD, YYYY  or  Month DD YYYY
  const longDate = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (longDate) {
    const months: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12",
    };
    const m = months[longDate[1].toLowerCase()];
    const d = longDate[2].padStart(2, "0");
    return `${longDate[3]}-${m}-${d}`;
  }

  // MM/DD/YYYY
  const slashed = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashed) {
    return `${slashed[3]}-${slashed[1].padStart(2, "0")}-${slashed[2].padStart(2, "0")}`;
  }

  return null;
}

/** Simple hash for change detection. */
async function quickHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin API key for scheduled/manual invocations
  const expectedKey = Deno.env.get("ADMIN_API_KEY");
  const providedKey = req.headers.get("X-Admin-API-Key");
  if (!expectedKey || providedKey !== expectedKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, adminKey);

  const results: { district_id: string; new_meetings: number; error?: string }[] = [];

  try {
    // Fetch all active board_listing sources
    const { data: sources, error: srcErr } = await supabase
      .from("district_sources")
      .select("id, district_id, url, last_hash")
      .eq("source_type", "board_listing")
      .eq("is_active", true);

    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No active sources", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const source of sources as DistrictSource[]) {
      let newCount = 0;
      try {
        // Fetch the listing page
        const resp = await fetch(source.url, {
          headers: { "User-Agent": "EdveraBot/1.0 (board-meeting-detector)" },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} fetching ${source.url}`);
        }
        const html = await resp.text();
        const hash = await quickHash(html);

        // Skip if content unchanged
        if (hash === source.last_hash) {
          await supabase
            .from("district_sources")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", source.id);
          results.push({ district_id: source.district_id, new_meetings: 0 });
          continue;
        }

        // Extract meetings
        const detected = extractMeetings(html, source.url);

        if (detected.length > 0) {
          // Get existing external_ids for this district
          const { data: existing } = await supabase
            .from("board_meetings")
            .select("external_id")
            .eq("district_id", source.district_id)
            .not("external_id", "is", null);

          const existingIds = new Set(
            (existing ?? []).map((r: { external_id: string }) => r.external_id)
          );

          const newMeetings = detected.filter(
            (m) => !existingIds.has(m.external_id)
          );

          for (const m of newMeetings) {
            const { error: insErr } = await supabase
              .from("board_meetings")
              .insert({
                district_id: source.district_id,
                external_id: m.external_id,
                meeting_date: m.meeting_date ?? null,
                title: "Board meeting update",
                source_url: m.meeting_url ?? source.url,
                summary_short:
                  "New board packet posted. Brief will appear soon. Tap Read Source for official documents.",
                status: "brief_pending",
                key_topics: [],
              });
            if (insErr) {
              console.error("Insert error:", insErr.message);
            } else {
              newCount++;
            }
          }
        }

        // Update source tracking
        await supabase
          .from("district_sources")
          .update({
            last_checked_at: new Date().toISOString(),
            last_hash: hash,
          })
          .eq("id", source.id);

        results.push({ district_id: source.district_id, new_meetings: newCount });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error processing source ${source.id}:`, msg);

        // Still update last_checked_at so we don't retry immediately
        await supabase
          .from("district_sources")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", source.id);

        results.push({
          district_id: source.district_id,
          new_meetings: 0,
          error: msg,
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fatal error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
