import { ActionItem, ActionPriority } from "@/types/actionCenter";

const CATEGORY_BASE: Record<string, number> = {
  alert: 30,
  task: 20,
  attendance: 15,
  note: 10,
};

export function scoreActionItem(
  item: ActionItem,
  now = new Date()
): { score: number; priority: ActionPriority } {
  let score = 0;

  // a) Base by category
  score += CATEGORY_BASE[item.category] ?? 0;

  // b) Time sensitivity (use dueAt or eventAt, whichever is present)
  const refDate = item.dueAt ?? item.eventAt;
  if (refDate) {
    const diff = new Date(refDate).getTime() - now.getTime();
    const diffHours = diff / (1000 * 60 * 60);

    if (diffHours < 0) {
      score += 35; // past due
    } else if (diffHours < 24) {
      score += 30; // <24h
    } else if (diffHours < 72) {
      score += 20; // 1-3 days
    } else if (diffHours < 168) {
      score += 10; // 3-7 days
    }
  }

  // c) Requires action
  if (item.requiresAction) {
    score += 15;
  }

  // d) Recurrence / daily confirmations (attendance gets extra weight)
  if (item.category === "attendance") {
    score += 5;
  }

  // e) Severity (alerts only)
  if (item.category === "alert" && item.severity != null) {
    score += Math.round(item.severity * 25);
  }

  // f) Source confidence
  if (item.source.confidence != null) {
    score += Math.round(item.source.confidence * 10);
  }

  // Cap 0..100
  score = Math.max(0, Math.min(100, score));

  // Priority mapping
  let priority: ActionPriority;
  if (score >= 70) {
    priority = "urgent";
  } else if (score >= 40) {
    priority = "soon";
  } else {
    priority = "fyi";
  }

  return { score, priority };
}
