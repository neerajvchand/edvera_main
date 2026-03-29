import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import type { Note } from "@/types/notes";

interface UseNotesParams {
  childId?: string;
  schoolId?: string;
  limit?: number;
}

function notesKey(params: UseNotesParams) {
  return ["notes", params.childId, params.schoolId] as const;
}

export function useNotes(params: UseNotesParams = {}) {
  const { childId, schoolId, limit } = params;
  const { session } = useSession();
  const userId = session?.user?.id;
  const qc = useQueryClient();
  const key = notesKey(params);

  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase
        .from("notes")
        .select("*")
        .eq("parent_id", userId!)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (childId) q = q.eq("child_id", childId);
      if (schoolId) q = q.eq("school_id", schoolId);
      if (limit) q = q.limit(limit);

      const { data, error } = await q;
      if (error) throw error;
      return data as Note[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notes"] });

  const addNote = useMutation({
    mutationFn: async (input: {
      content: string;
      child_id?: string;
      school_id: string;
      pinned?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          parent_id: userId!,
          content: input.content,
          child_id: input.child_id ?? null,
          school_id: input.school_id,
          pinned: input.pinned ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; content?: string; pinned?: boolean }) => {
      const { error } = await supabase.from("notes").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { notes, isLoading, error, addNote, updateNote, deleteNote };
}
