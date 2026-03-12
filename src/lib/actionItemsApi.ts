import { supabase } from "@/integrations/supabase/client";
import { ActionItem } from "@/types/actionCenter";

interface DbActionItem {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string | null;
  due_at: string | null;
  event_at: string | null;
  expires_at: string | null;
  snoozed_until: string | null;
  status: string;
  severity: number | null;
  requires_action: boolean | null;
  tags: string[] | null;
  source_kind: string;
  source_label: string | null;
  source_url: string | null;
  source_confidence: number | null;
  created_at: string;
  updated_at: string;
}

function mapDbToActionItem(row: DbActionItem): ActionItem {
  return {
    id: row.id,
    category: row.category as ActionItem["category"],
    title: row.title,
    description: row.description ?? undefined,
    dueAt: row.due_at ?? undefined,
    eventAt: row.event_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    snoozedUntil: row.snoozed_until ?? undefined,
    createdAt: row.created_at,
    source: {
      kind: row.source_kind as ActionItem["source"]["kind"],
      label: row.source_label ?? undefined,
      url: row.source_url ?? undefined,
      confidence: row.source_confidence ?? undefined,
    },
    status: row.status as ActionItem["status"],
    severity: row.severity ?? undefined,
    requiresAction: row.requires_action ?? undefined,
    tags: row.tags ?? undefined,
  };
}

export async function fetchActionItems(userId: string): Promise<ActionItem[]> {
  const { data, error } = await supabase
    .from("action_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as DbActionItem[]).map(mapDbToActionItem);
}

export async function createActionItem(
  item: Partial<ActionItem> & { title: string; category: string },
  userId: string
): Promise<ActionItem> {
  const { data, error } = await supabase
    .from("action_items")
    .insert({
      user_id: userId,
      category: item.category,
      title: item.title,
      description: item.description ?? null,
      due_at: item.dueAt ?? null,
      event_at: item.eventAt ?? null,
      status: item.status ?? "open",
      severity: item.severity ?? null,
      requires_action: item.requiresAction ?? false,
      tags: item.tags ?? [],
      source_kind: item.source?.kind ?? "user",
      source_label: item.source?.label ?? null,
      source_url: item.source?.url ?? null,
      source_confidence: item.source?.confidence ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapDbToActionItem(data as DbActionItem);
}

export async function updateActionItem(
  id: string,
  patch: { status?: string; title?: string; description?: string; due_at?: string | null; snoozed_until?: string | null; expires_at?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from("action_items")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteActionItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("action_items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
