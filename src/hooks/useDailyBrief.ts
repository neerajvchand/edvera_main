import { useMemo } from 'react';
import { useSelectedChild } from '@/hooks/useSelectedChild';
import { useTodayGlance, TodayGlance } from '@/hooks/useTodayGlance';
import { useComingUp, ComingUpEvent } from '@/hooks/useComingUp';
import { scenarios } from '@/data/dummyData';
import { enrichAndSortItems } from '@/lib/urgencyUtils';
import { format } from 'date-fns';

export interface DailyBriefResult {
  brief: string;
  sources: string[];
  reasons: string[];
  loading: boolean;
  error?: boolean;
}

function formatTime12(t: string | null): string {
  if (!t) return '';
  const parts = t.split(':');
  const hour = parseInt(parts[0]);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min} ${ampm}`;
}

function getDayOfWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return format(d, 'EEEE');
  } catch {
    return '';
  }
}

function buildBrief(
  glance: TodayGlance | undefined,
  events: ComingUpEvent[],
  actionItems: { overdueCount: number; dueTodayCount: number } | null,
): { brief: string; sources: string[]; reasons: string[] } {
  const lines: string[] = [];
  const sources: string[] = [];
  const reasons: string[] = [];

  // Normalize day type
  const dayType = glance?.day_type ?? '';
  const isHoliday = ['No School', 'Holiday', 'Weekend'].includes(dayType);
  const isMinimum = dayType === 'Minimum Day';
  const pickupTime = formatTime12(glance?.pickup_time ?? null);

  // Check for field trip today in events
  const todayStr = new Date().toDateString();
  const fieldTripToday = events.find(e => {
    const eDate = new Date(e.start_time).toDateString();
    return eDate === todayStr && (e.title?.toLowerCase().includes('field trip') || e.category?.toLowerCase() === 'field trip');
  });

  // A) Opening
  if (isHoliday) {
    const holidayName = glance?.notes || dayType;
    lines.push(`Enjoy your day off — ${holidayName}.`);
    reasons.push(`${dayType} detected`);
  } else if (fieldTripToday) {
    lines.push(`Exciting day ahead! Field trip: ${fieldTripToday.title}.`);
    reasons.push('Field trip scheduled today');
  } else {
    const dow = new Date().getDay();
    if (dow === 1) {
      lines.push("Good morning! It's Monday — here's what's coming up.");
    } else if (dow === 5) {
      lines.push("Happy Friday! Here's today's plan.");
    } else {
      lines.push("Good morning! Here's your day at a glance.");
    }
  }

  // B) Schedule sentence
  if (glance) {
    sources.push("Today's Schedule");
    if (isHoliday) {
      lines.push('No school today.');
      reasons.push('No school schedule');
    } else if (isMinimum) {
      lines.push(`Minimum day today — pickup at ${pickupTime} (earlier than usual).`);
      reasons.push('Minimum day schedule in effect');
    } else if (pickupTime) {
      lines.push(`Regular schedule today — pickup at ${pickupTime}.`);
      reasons.push('Normal schedule today');
    }
  }

  // C) Action items sentence
  if (actionItems) {
    sources.push('Action Items');
    if (actionItems.overdueCount > 0) {
      lines.push(`You have ${actionItems.overdueCount} overdue item${actionItems.overdueCount > 1 ? 's' : ''} to take care of.`);
      reasons.push(`${actionItems.overdueCount} overdue action item(s)`);
    } else if (actionItems.dueTodayCount > 0) {
      lines.push(`You have ${actionItems.dueTodayCount} item${actionItems.dueTodayCount > 1 ? 's' : ''} due today.`);
      reasons.push(`${actionItems.dueTodayCount} item(s) due today`);
    } else {
      lines.push("You're all caught up on action items.");
      reasons.push('No urgent action items');
    }
  }

  // D) Upcoming preview — pick 1 priority event
  if (events.length > 0) {
    sources.push('Calendar');

    // Filter to future events (not today)
    const futureEvents = events.filter(e => new Date(e.start_time).toDateString() !== todayStr);

    if (futureEvents.length > 0) {
      // Priority: Holiday/No School > Minimum > Field trip > other
      const prioritized = [...futureEvents].sort((a, b) => {
        const prio = (e: ComingUpEvent) => {
          const t = (e.title || '').toLowerCase();
          const cat = (e.category || '').toLowerCase();
          if (t.includes('no school') || t.includes('holiday')) return 0;
          if (t.includes('minimum') || cat.includes('minimum')) return 1;
          if (t.includes('field trip') || cat.includes('field trip')) return 2;
          if (t.includes('deadline') || t.includes('due')) return 3;
          return 4;
        };
        return prio(a) - prio(b);
      });

      const top = prioritized[0];
      const dow = getDayOfWeek(top.start_time);
      let headsUp = `Heads up: ${top.title} on ${dow}.`;

      const titleLower = (top.title || '').toLowerCase();
      if (titleLower.includes('minimum')) {
        headsUp += ' Early pickup.';
      }
      if (titleLower.includes('field trip')) {
        headsUp += ' Remember permission slip / lunch if needed.';
      }

      lines.push(headsUp);
      reasons.push(`Upcoming: ${top.title}`);
    } else if (!sources.includes('Calendar')) {
      // no future events
    }
  }

  if (events.length === 0 && sources.includes('Calendar') === false) {
    lines.push('No major events coming up this week.');
  }

  return {
    brief: lines.slice(0, 4).join(' '),
    sources,
    reasons,
  };
}

export function useDailyBrief(): DailyBriefResult {
  const { school } = useSelectedChild();
  const { data: glance, isLoading: glanceLoading, error: glanceError } = useTodayGlance(school?.id);
  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useComingUp(school?.id, 10);

  // Use dummy action items (until action items are also live)
  const actionItems = scenarios.normal.actionItems;

  const actionSummary = useMemo(() => {
    const enriched = enrichAndSortItems(actionItems);
    const overdueCount = enriched.filter(i => i.urgencyCategory === 'overdue').length;
    const dueTodayCount = enriched.filter(i => i.urgencyCategory === 'due-today').length;
    return { overdueCount, dueTodayCount };
  }, [actionItems]);

  const loading = glanceLoading || eventsLoading || !school;
  const hasError = !!glanceError && !!eventsError;

  const result = useMemo(() => {
    if (hasError) {
      return {
        brief: 'Check back soon for today\'s brief.',
        sources: [] as string[],
        reasons: ['Error loading data'] as string[],
      };
    }
    return buildBrief(glance ?? undefined, events, actionSummary);
  }, [glance, events, actionSummary, hasError]);

  return {
    ...result,
    loading,
    error: hasError,
  };
}
