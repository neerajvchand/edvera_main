import { ActionItem } from "@/types/schoolpulse";
import { format, differenceInHours, differenceInMinutes, differenceInDays, isSameDay, isAfter } from "date-fns";

export type UrgencyCategory = 'overdue' | 'due-today' | 'due-soon' | 'upcoming';

export interface EnrichedActionItem extends ActionItem {
  urgencyCategory: UrgencyCategory;
  urgencyLabel: string;
  countdownLabel?: string; // e.g. "⏳ Due in 4h 12m"
  sortPriority: number;
}

/**
 * Parses a dueAt ISO string, falling back to dueDate at 2:45 PM local time.
 */
function parseDueAt(item: ActionItem): Date {
  if (item.dueAt) {
    return new Date(item.dueAt);
  }
  // Default: 2:45 PM local on due date
  return new Date(`${item.dueDate}T14:45:00`);
}

/**
 * Computes urgency category and labels for a single action item.
 */
export function computeUrgency(item: ActionItem, now: Date = new Date()): EnrichedActionItem {
  const dueDate = parseDueAt(item);
  const hoursUntilDue = differenceInHours(dueDate, now);
  const minutesUntilDue = differenceInMinutes(dueDate, now);
  const daysUntilDue = differenceInDays(dueDate, now);

  // Overdue
  if (isAfter(now, dueDate)) {
    const overdueDays = differenceInDays(now, dueDate);
    const overdueHours = differenceInHours(now, dueDate);
    let urgencyLabel: string;

    if (overdueDays >= 1) {
      urgencyLabel = `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`;
    } else {
      urgencyLabel = `Overdue by ${overdueHours}h`;
    }

    return {
      ...item,
      urgencyCategory: 'overdue',
      urgencyLabel,
      sortPriority: 0,
    };
  }

  // Due Today (same calendar day)
  if (isSameDay(dueDate, now)) {
    const timeStr = format(dueDate, "h:mm a");
    let countdownLabel: string | undefined;

    if (hoursUntilDue <= 6) {
      const hours = Math.floor(minutesUntilDue / 60);
      const mins = minutesUntilDue % 60;
      countdownLabel = hours > 0 
        ? `⏳ Due in ${hours}h ${mins}m` 
        : `⏳ Due in ${mins}m`;
    }

    return {
      ...item,
      urgencyCategory: 'due-today',
      urgencyLabel: `Due Today (${timeStr})`,
      countdownLabel,
      sortPriority: 1,
    };
  }

  // Due Soon (within 48 hours)
  if (hoursUntilDue <= 48) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isDueTomorrow = isSameDay(dueDate, tomorrow);

    let countdownLabel: string | undefined;
    if (hoursUntilDue <= 6) {
      const hours = Math.floor(minutesUntilDue / 60);
      const mins = minutesUntilDue % 60;
      countdownLabel = hours > 0 
        ? `⏳ Due in ${hours}h ${mins}m` 
        : `⏳ Due in ${mins}m`;
    }

    return {
      ...item,
      urgencyCategory: 'due-soon',
      urgencyLabel: isDueTomorrow ? "Due Tomorrow" : `Due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`,
      countdownLabel,
      sortPriority: 2,
    };
  }

  // Upcoming
  return {
    ...item,
    urgencyCategory: 'upcoming',
    urgencyLabel: `Due ${format(dueDate, "MMM d")}`,
    sortPriority: 3,
  };
}

/**
 * Enrich and sort action items by urgency. Only open items are processed.
 */
export function enrichAndSortItems(items: ActionItem[], now: Date = new Date()): EnrichedActionItem[] {
  return items
    .filter(item => item.status === 'open')
    .map(item => computeUrgency(item, now))
    .sort((a, b) => {
      if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
      // Within same priority, sort by due date ascending
      const aDue = a.dueAt ? new Date(a.dueAt) : new Date(`${a.dueDate}T14:45:00`);
      const bDue = b.dueAt ? new Date(b.dueAt) : new Date(`${b.dueDate}T14:45:00`);
      return aDue.getTime() - bDue.getTime();
    });
}

/**
 * Get the overall status summary for the header.
 */
export function getOverallUrgencyStatus(enrichedItems: EnrichedActionItem[]): {
  emoji: string;
  text: string;
  subtitle?: string;
  containerClass: string;
} {
  if (enrichedItems.length === 0) {
    return {
      emoji: "✅",
      text: "Nothing urgent",
      subtitle: "You're all set. No actions needed.",
      containerClass: "status-container-success",
    };
  }

  const hasOverdue = enrichedItems.some(i => i.urgencyCategory === 'overdue');
  const hasDueToday = enrichedItems.some(i => i.urgencyCategory === 'due-today');

  if (hasOverdue) {
    const overdueCount = enrichedItems.filter(i => i.urgencyCategory === 'overdue').length;
    return {
      emoji: "🔴",
      text: `${overdueCount} overdue item${overdueCount > 1 ? 's' : ''}`,
      containerClass: "status-container-urgent",
    };
  }

  if (hasDueToday) {
    return {
      emoji: "🟠",
      text: `Due today`,
      containerClass: "status-container-caution",
    };
  }

  const count = enrichedItems.length;
  return {
    emoji: "⚠️",
    text: `${count} upcoming item${count > 1 ? 's' : ''}`,
    containerClass: "status-container-warning",
  };
}
