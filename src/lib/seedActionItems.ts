import { supabase } from "@/integrations/supabase/client";

function endOfDayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

const SEED_ITEMS = [
  {
    category: "attendance",
    title: "Confirm today's attendance",
    description: "Tap to mark Present/Absent so your Action Center stays accurate.",
    requires_action: true,
    source_kind: "system",
    source_label: "Edvera",
    tags: ["seed_v1", "attendance"],
    expires_at: endOfDayISO(),
  },
  {
    category: "task",
    title: "Add your first school to-do",
    description: "Permission slips, picture day, reminders—capture it here.",
    requires_action: false,
    source_kind: "system",
    source_label: "Edvera",
    tags: ["seed_v1", "onboarding"],
    expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
  },
  {
    category: "note",
    title: "Quick note for later",
    description: "Anything you don't want to forget—store it here.",
    requires_action: false,
    source_kind: "system",
    source_label: "Edvera",
    tags: ["seed_v1", "onboarding"],
    expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
  },
];

export async function seedActionItemsIfNeeded(userId: string): Promise<void> {
  // Check if seed_v1 items already exist
  const { data, error } = await supabase
    .from("action_items")
    .select("id")
    .eq("user_id", userId)
    .eq("source_kind", "system")
    .contains("tags", ["seed_v1"])
    .limit(1);

  if (error) {
    console.warn("[seedActionItems] check failed:", error.message);
    return;
  }

  if (data && data.length > 0) return; // already seeded

  const rows = SEED_ITEMS.map((item) => ({ ...item, user_id: userId, status: "open" }));

  const { error: insertError } = await supabase.from("action_items").insert(rows);

  if (insertError) {
    console.warn("[seedActionItems] insert failed:", insertError.message);
  }
}
