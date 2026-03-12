import type { ActionListItem, ActionStats } from "@/types/action";

/**
 * Compute action statistics from the fetched action list.
 * Pure function — no DB call. Can be used in hooks or components.
 */
export function getActionStats(
  actions: ActionListItem[],
  isOverdue: (dueDate: string) => boolean
): ActionStats {
  const open = actions.filter((a) => a.status === "open");
  const today = new Date().toISOString().slice(0, 10);

  return {
    totalOpen: open.length,
    overdue: open.filter((a) => isOverdue(a.due_date)).length,
    urgent: open.filter((a) => a.priority === "urgent").length,
    completedToday: actions.filter(
      (a) =>
        a.status === "completed" &&
        a.completed_at != null &&
        a.completed_at.slice(0, 10) === today
    ).length,
  };
}
