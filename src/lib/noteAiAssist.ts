import { supabase } from "@/integrations/supabase/client";

export type AiMode = "refine" | "extract_todos" | "draft_message";

export interface AiResult {
  refined: string;
  todos: { title: string; details: string | null; due_date: string | null }[];
  draft_message: string;
  tags: string[];
}

export async function callNoteAiAssist(mode: AiMode, userText: string): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke("note-ai-assist", {
    body: { mode, user_text: userText },
  });

  if (error) throw new Error(error.message ?? "AI request failed");

  // data is already parsed JSON from invoke
  const result = typeof data === "string" ? JSON.parse(data) : data;

  if (result.error) throw new Error(result.error);

  return {
    refined: result.refined ?? "",
    todos: Array.isArray(result.todos) ? result.todos : [],
    draft_message: result.draft_message ?? "",
    tags: Array.isArray(result.tags) ? result.tags : [],
  };
}
