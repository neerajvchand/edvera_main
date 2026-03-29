import { format, isToday, isTomorrow, parseISO } from "date-fns";

export function formatEventDay(dateString: string): string {
  const date = parseISO(dateString);
  
  if (isToday(date)) {
    return "Today";
  }
  
  if (isTomorrow(date)) {
    return "Tomorrow";
  }
  
  return format(date, "EEE");
}

export function formatFullDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "EEEE, MMMM d, yyyy");
}

export function formatShortDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "EEE, MMM d");
}

export function formatDueDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "MMM d");
}

export function getCurrentTime(): string {
  return format(new Date(), "h:mm a");
}
