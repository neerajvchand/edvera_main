import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import type { Todo } from "@/types/todos";

interface UseTodosParams {
  childId?: string;
  schoolId?: string;
  limit?: number;
  status?: "open" | "done" | "dismissed";
}

function todosKey(params: UseTodosParams) {
  return ["todos", params.childId, params.schoolId, params.status] as const;
}

export function useTodos(params: UseTodosParams = {}) {
  const { status = "open", childId, schoolId, limit } = params;
  const { session } = useSession();
  const userId = session?.user?.id;
  const qc = useQueryClient();
  const key = todosKey(params);

  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase
        .from("todos")
        .select("*")
        .eq("parent_id", userId!)
        .eq("status", status)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (childId) q = q.eq("child_id", childId);
      if (schoolId) q = q.eq("school_id", schoolId);
      if (limit) q = q.limit(limit);

      const { data, error } = await q;
      if (error) throw error;
      return data as Todo[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["todos"] });

  const addTodo = useMutation({
    mutationFn: async (input: {
      title: string;
      details?: string;
      due_date?: string;
      child_id?: string;
      school_id: string;
    }) => {
      const { data, error } = await supabase
        .from("todos")
        .insert({
          parent_id: userId!,
          title: input.title,
          details: input.details ?? null,
          due_date: input.due_date ?? null,
          child_id: input.child_id ?? null,
          school_id: input.school_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Todo;
    },
    onSuccess: invalidate,
  });

  const updateTodo = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<Pick<Todo, "title" | "details" | "due_date" | "status">>) => {
      const { error } = await supabase.from("todos").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").update({ status: "done" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").update({ status: "dismissed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const snooze = useMutation({
    mutationFn: async ({ id, newDueDate }: { id: string; newDueDate: string }) => {
      const { error } = await supabase.from("todos").update({ due_date: newDueDate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { todos, isLoading, error, addTodo, updateTodo, markDone, dismiss, snooze };
}
