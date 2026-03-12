import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export interface Announcement {
  id: string;
  school_id: string;
  title: string;
  body: string;
  audience: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export function useAdminAnnouncements(schoolId: string | null) {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery<Announcement[]>({
    queryKey: ["admin_announcements", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Announcement[];
    },
    enabled: !!schoolId,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Announcement> & { title: string; body: string }) => {
      if (!schoolId || !user) throw new Error("Missing context");
      const isNew = !input.id;

      const payload = {
        school_id: schoolId,
        title: input.title,
        body: input.body,
        audience: input.audience ?? "all",
        starts_at: input.starts_at ?? new Date().toISOString(),
        ends_at: input.ends_at ?? null,
        status: input.status ?? "published",
        ...(isNew ? { created_by: user.id } : {}),
        updated_by: user.id,
      };

      let result;
      if (isNew) {
        const { data, error } = await supabase.from("announcements").insert(payload as any).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.from("announcements").update(payload as any).eq("id", input.id!).select().single();
        if (error) throw error;
        result = data;
      }

      await supabase.from("audit_log").insert({
        school_id: schoolId,
        actor_user_id: user.id,
        action: isNew ? "CREATE_ANNOUNCEMENT" : "UPDATE_ANNOUNCEMENT",
        entity: "announcements",
        entity_id: result.id,
      } as any);

      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_announcements", schoolId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!schoolId || !user) throw new Error("Missing context");
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;

      await supabase.from("audit_log").insert({
        school_id: schoolId,
        actor_user_id: user.id,
        action: "DELETE_ANNOUNCEMENT",
        entity: "announcements",
        entity_id: id,
      } as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_announcements", schoolId] }),
  });

  // Counts for dashboard
  const activeCount = (query.data ?? []).filter(
    (a) => a.status === "published" && (!a.ends_at || new Date(a.ends_at) > new Date())
  ).length;

  return {
    announcements: query.data ?? [],
    activeCount,
    isLoading: query.isLoading,
    upsert: upsert.mutateAsync,
    isUpserting: upsert.isPending,
    remove: remove.mutateAsync,
    isRemoving: remove.isPending,
  };
}
