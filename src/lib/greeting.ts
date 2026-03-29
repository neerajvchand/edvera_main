/**
 * Returns a time-of-day greeting, optionally personalized.
 */
export function getGreeting(opts?: { displayName?: string | null; now?: Date }): string {
  const now = opts?.now ?? new Date();
  const hour = now.getHours();

  let base: string;
  if (hour < 12) base = "Good morning";
  else if (hour < 17) base = "Good afternoon";
  else base = "Good evening";

  const name = opts?.displayName?.trim();
  return name ? `${base}, ${name}.` : `${base}.`;
}
