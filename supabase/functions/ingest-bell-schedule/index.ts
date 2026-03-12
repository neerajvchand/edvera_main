import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function validateExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.startsWith('169.254.') ||
      hostname === '[::1]' ||
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fe80:')
    ) return false;
    return true;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Admin auth: require X-Admin-API-Key header
    const adminKey = req.headers.get('X-Admin-API-Key');
    const expectedKey = Deno.env.get('ADMIN_API_KEY');
    if (!expectedKey || adminKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { school_id } = await req.json();

    if (!school_id) {
      return new Response(JSON.stringify({ error: 'school_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch school record
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', school_id)
      .single();

    if (schoolError || !school) {
      return new Response(JSON.stringify({ error: 'School not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!school.bell_schedule_url) {
      return new Response(JSON.stringify({ error: 'No bell_schedule_url configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL before fetching
    if (!validateExternalUrl(school.bell_schedule_url)) {
      return new Response(JSON.stringify({ error: 'Invalid or disallowed bell schedule URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch bell schedule page with timeout
    const res = await fetch(school.bell_schedule_url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    if (html.length > 10_000_000) throw new Error('Response too large');

    // Parse schedules from HTML
    const schedules = parseBellScheduleHTML(html);

    if (schedules.length === 0) {
      return new Response(JSON.stringify({ message: 'No schedules found in HTML', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let synced = 0;

    for (const schedule of schedules) {
      const { data: bs, error: bsError } = await supabase
        .from('bell_schedules')
        .upsert({
          school_id: school.id,
          schedule_name: schedule.name,
        }, {
          onConflict: 'school_id,schedule_name',
        })
        .select('id')
        .single();

      if (bsError || !bs) continue;

      await supabase
        .from('bell_blocks')
        .delete()
        .eq('bell_schedule_id', bs.id);

      const blocks = schedule.blocks.map((block: any, idx: number) => ({
        bell_schedule_id: bs.id,
        label: block.label,
        start_local: block.start,
        end_local: block.end,
        sort_order: idx + 1,
      }));

      const { error: blockError } = await supabase
        .from('bell_blocks')
        .insert(blocks);

      if (!blockError) synced += blocks.length;
    }

    return new Response(JSON.stringify({ synced, schedules: schedules.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface ParsedBlock {
  label: string;
  start: string;
  end: string;
}

interface ParsedSchedule {
  name: string;
  blocks: ParsedBlock[];
}

function parseBellScheduleHTML(html: string): ParsedSchedule[] {
  const schedules: ParsedSchedule[] = [];

  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi;

  const sections = html.split(/<h[2-4][^>]*>/i);

  if (sections.length > 1) {
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const headingEnd = section.indexOf('</h');
      const heading = headingEnd > 0 ? section.substring(0, headingEnd).replace(/<[^>]+>/g, '').trim() : 'Regular';

      const blocks: ParsedBlock[] = [];
      const textContent = section.replace(/<[^>]+>/g, '\n');
      const lines = textContent.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        if (timeMatch) {
          const label = line.substring(0, line.indexOf(timeMatch[0])).replace(/[:\-–]/g, '').trim() || `Period ${blocks.length + 1}`;
          blocks.push({
            label,
            start: normalizeTime(timeMatch[1]),
            end: normalizeTime(timeMatch[2]),
          });
        }
      }

      if (blocks.length > 0) {
        schedules.push({ name: heading, blocks });
      }
    }
  }

  if (schedules.length === 0) {
    const blocks: ParsedBlock[] = [];
    const textContent = html.replace(/<[^>]+>/g, '\n');
    const lines = textContent.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      if (timeMatch) {
        const label = line.substring(0, line.indexOf(timeMatch[0])).replace(/[:\-–]/g, '').trim() || `Period ${blocks.length + 1}`;
        blocks.push({
          label,
          start: normalizeTime(timeMatch[1]),
          end: normalizeTime(timeMatch[2]),
        });
      }
    }

    if (blocks.length > 0) {
      schedules.push({ name: 'Regular', blocks });
    }
  }

  return schedules;
}

function normalizeTime(timeStr: string): string {
  const cleaned = timeStr.trim();
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return cleaned;

  let hour = parseInt(match[1]);
  const min = match[2];
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, '0')}:${min}`;
}
