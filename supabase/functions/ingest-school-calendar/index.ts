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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Admin auth: require X-Admin-API-Key header, service role key, or valid JWT
    const adminKey = req.headers.get('X-Admin-API-Key');
    const expectedKey = Deno.env.get('ADMIN_API_KEY');
    const authHeader = req.headers.get('Authorization');
    const isBearerServiceRole = authHeader && supabaseServiceKey && authHeader === `Bearer ${supabaseServiceKey}`;
    const isAdminKey = expectedKey && adminKey === expectedKey;
    
    let isAuthenticatedUser = false;
    if (!isAdminKey && !isBearerServiceRole && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      isAuthenticatedUser = !!user;
    }
    
    if (!isAdminKey && !isBearerServiceRole && !isAuthenticatedUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    let events: any[] = [];
    const counters = { uid_count: 0, fallback_hash_count: 0, final_fallback_count: 0, html_count: 0 };

    // Try ICS/RSS feed first
    if (school.calendar_feed_url) {
      if (!validateExternalUrl(school.calendar_feed_url)) {
        return new Response(JSON.stringify({ error: 'Invalid or disallowed calendar URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(school.calendar_feed_url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      if (text.length > 10_000_000) throw new Error('Response too large');

      if (text.includes('BEGIN:VCALENDAR')) {
        events = parseICS(text, school.id, counters);
      } else if (text.includes('<rss') || text.includes('<feed')) {
        events = parseRSS(text, school.id, counters);
      }
    }

    // If no feed events, try HTML calendar page (Finalsite format)
    if (events.length === 0 && school.calendar_page_url) {
      if (!validateExternalUrl(school.calendar_page_url)) {
        return new Response(JSON.stringify({ error: 'Invalid or disallowed calendar page URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('No feed events, trying HTML calendar page:', school.calendar_page_url);
      const res = await fetch(school.calendar_page_url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SchoolCalendarBot/1.0)',
          'Accept': 'text/html',
        },
      });
      const html = await res.text();
      if (html.length > 10_000_000) throw new Error('HTML response too large');

      events = parseFinalsiteHTML(html, school.id, counters);
      console.log(`Parsed ${events.length} events from HTML page`);
    }

    // Final safety: guarantee every event has a non-empty source_event_id
    for (const event of events) {
      if (!event.source_event_id) {
        event.source_event_id = 'final:' + hashString(
          (event.title || '') + '|' + (event.start_time || '') + '|' +
          (event.end_time || '') + '|' + (event.source || '') + '|' +
          (event.location || '')
        );
        counters.final_fallback_count++;
      }
    }

    // Upsert events
    let synced = 0;
    for (const event of events) {
      // Check if event already exists (partial unique index doesn't work with upsert)
      const { data: existing } = await supabase
        .from('school_events')
        .select('id')
        .eq('school_id', event.school_id)
        .eq('source_event_id', event.source_event_id)
        .maybeSingle();

      let error;
      if (existing) {
        ({ error } = await supabase.from('school_events').update(event).eq('id', existing.id));
      } else {
        ({ error } = await supabase.from('school_events').insert(event));
      }
      if (!error) synced++;
      else console.error('Upsert error:', error.message, 'for event:', event.title);
    }

    return new Response(JSON.stringify({ synced, total: events.length, counters }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Ingestion error:', err);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Finalsite HTML Parser ───────────────────────────────────────────────────

function parseFinalsiteHTML(html: string, schoolId: string, counters: { html_count: number }): any[] {
  const events: any[] = [];
  const now = new Date();

  // Match each fsCalendarInfo block containing an event
  // Pattern: <a ... class="fsCalendarEventTitle ..." title="EVENT_TITLE" data-occur-id="ID" ...>
  // Followed by optional <time datetime="..."> elements
  const eventBlockRegex = /<div class="fsCalendarInfo">([\s\S]*?)<\/div>\s*(?=<div class="fsCalendarInfo">|<\/div>\s*<\/div>|<div class="fsCalendarDaybox")/g;

  // Simpler approach: find all event title links and their surrounding context
  const titleRegex = /<a[^>]*class="fsCalendarEventTitle[^"]*"[^>]*title="([^"]*)"[^>]*data-occur-id="(\d+)"[^>]*>[^<]*<\/a>/g;
  
  // Also extract time blocks that follow each title
  // We'll process the HTML in sections per daybox
  const dayboxRegex = /<div class="fsCalendarDaybox[^"]*"[^>]*>([\s\S]*?)(?=<div class="fsCalendarDaybox|<\/div>\s*<\/div>\s*<div class="fsCalendarRow">|$)/g;

  let dayboxMatch;
  while ((dayboxMatch = dayboxRegex.exec(html)) !== null) {
    const dayboxContent = dayboxMatch[1];

    // Extract date from fsCalendarDate
    const dateMatch = dayboxContent.match(/<div class="fsCalendarDate"[^>]*data-day="(\d+)"[^>]*data-year="(\d+)"[^>]*data-month="(\d+)"/);
    if (!dateMatch) continue;

    const day = parseInt(dateMatch[1]);
    const year = parseInt(dateMatch[2]);
    const month = parseInt(dateMatch[3]); // Finalsite uses 0-indexed months

    // Find all events in this daybox
    const infoRegex = /<a[^>]*class="fsCalendarEventTitle[^"]*"[^>]*title="([^"]*)"[^>]*data-occur-id="(\d+)"[^>]*>[\s\S]*?<\/a>([\s\S]*?)(?=<\/div>\s*<div class="fsCalendarInfo">|<\/div>\s*$)/g;

    let eventMatch;
    while ((eventMatch = infoRegex.exec(dayboxContent)) !== null) {
      const title = decodeHTMLEntities(eventMatch[1]);
      const occurId = eventMatch[2];
      const afterTitle = eventMatch[3];

      // Extract start and end times from <time> elements
      const startTimeMatch = afterTitle.match(/<time[^>]*datetime="([^"]*)"[^>]*class="fsStartTime"/);
      const endTimeMatch = afterTitle.match(/<time[^>]*datetime="([^"]*)"[^>]*class="fsEndTime"/);

      // Extract location if present
      const locationMatch = afterTitle.match(/<div class="fsLocation">\s*([\s\S]*?)\s*<\/div>/);

      let startTime: string;
      let endTime: string | null = null;
      let allDay = false;

      if (startTimeMatch) {
        startTime = startTimeMatch[1]; // ISO format with timezone offset
        endTime = endTimeMatch ? endTimeMatch[1] : null;
      } else {
        // All-day event — construct date from daybox data
        // Finalsite months are 0-indexed (January = 0)
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        startTime = `${year}-${monthStr}-${dayStr}T00:00:00-08:00`;
        allDay = true;
      }

      // Only include future or recent events (within last 7 days)
      const eventDate = new Date(startTime);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (eventDate < sevenDaysAgo) continue;

      counters.html_count++;

      events.push({
        school_id: schoolId,
        source: 'HTML',
        source_event_id: `fs-occur-${occurId}`,
        title,
        description: null,
        location: locationMatch ? decodeHTMLEntities(locationMatch[1].trim()) : null,
        start_time: startTime,
        end_time: endTime,
        all_day: allDay,
        category: categorizeEvent(title),
        last_seen_at: new Date().toISOString(),
      });
    }
  }

  return events;
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function categorizeEvent(title: string): string | null {
  const lower = title.toLowerCase();
  if (/holiday|no school|break|presidents|memorial|labor|thanksgiving/i.test(lower)) return 'Holiday';
  if (/minimum day|early dismissal|early release|minimum/i.test(lower)) return 'Schedule';
  if (/pta|parent.*meeting|back to school night|open house|conference/i.test(lower)) return 'Meeting';
  if (/board meeting|regular board|school board/i.test(lower)) return 'Meeting';
  if (/club|workshop|practice|rehearsal/i.test(lower)) return 'Club';
  if (/fair|carnival|celebration|show|performance|concert|night/i.test(lower)) return 'Event';
  if (/picture day|photo/i.test(lower)) return 'Event';
  if (/field trip|outdoor ed|excursion/i.test(lower)) return 'Event';
  return null;
}

// ─── ICS Parser ──────────────────────────────────────────────────────────────

function parseICS(text: string, schoolId: string, counters: { uid_count: number; fallback_hash_count: number; final_fallback_count: number }): any[] {
  const events: any[] = [];
  const blocks = text.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];

    const getField = (key: string): string | null => {
      const unfoldedBlock = block.replace(/\r?\n[ \t]/g, '');
      const regex = new RegExp(`^${key}[;:](.+)$`, 'm');
      const match = unfoldedBlock.match(regex);
      if (!match) return null;
      const val = match[1];
      const colonIdx = val.indexOf(':');
      return colonIdx >= 0 && match[0].includes(';') ? val.substring(colonIdx + 1) : val;
    };

    const uid = getField('UID');
    const summary = getField('SUMMARY');
    const description = getField('DESCRIPTION');
    const location = getField('LOCATION');
    const dtstart = getField('DTSTART');
    const dtend = getField('DTEND');

    if (!summary || !dtstart) continue;

    const startDate = parseICSDate(dtstart);
    const endDate = dtend ? parseICSDate(dtend) : null;
    const allDay = dtstart.length === 8;

    const sourceEventId = uid
      ? (counters.uid_count++, uid)
      : (counters.fallback_hash_count++, hashString(`${summary}-${dtstart}`));

    events.push({
      school_id: schoolId,
      source: 'ICS',
      source_event_id: sourceEventId,
      title: summary.replace(/\\,/g, ',').replace(/\\n/g, ' '),
      description: description?.replace(/\\,/g, ',').replace(/\\n/g, '\n') || null,
      location: location?.replace(/\\,/g, ',') || null,
      start_time: startDate,
      end_time: endDate,
      all_day: allDay,
      category: null,
      last_seen_at: new Date().toISOString(),
    });
  }

  return events;
}

function parseICSDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T00:00:00Z`;
  }
  const clean = dateStr.replace(/[^0-9TZ]/g, '');
  if (clean.length >= 15) {
    const d = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
    return clean.endsWith('Z') ? `${d}Z` : d;
  }
  return dateStr;
}

// ─── RSS Parser ──────────────────────────────────────────────────────────────

function parseRSS(text: string, schoolId: string, counters: { uid_count: number; fallback_hash_count: number; final_fallback_count: number }): any[] {
  const events: any[] = [];
  const items = text.split('<item>').slice(1);

  for (const item of items) {
    const getTag = (tag: string): string | null => {
      const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return match ? match[1].replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').trim() : null;
    };

    const title = getTag('title');
    const description = getTag('description');
    const pubDate = getTag('pubDate');
    const guid = getTag('guid');

    if (!title || !pubDate) continue;

    const startTime = new Date(pubDate).toISOString();

    const sourceEventId = guid
      ? (counters.uid_count++, guid)
      : (counters.fallback_hash_count++, hashString(`${title}-${pubDate}`));

    events.push({
      school_id: schoolId,
      source: 'RSS',
      source_event_id: sourceEventId,
      title,
      description: description || null,
      location: null,
      start_time: startTime,
      end_time: null,
      all_day: false,
      category: null,
      last_seen_at: new Date().toISOString(),
    });
  }

  return events;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash-${Math.abs(hash).toString(36)}`;
}
