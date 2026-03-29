import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export interface AdminSchoolEvent {
  id: string;
  school_id: string;
  title: string;
  location: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  category: string | null;
  source: string;
  created_at: string;
}

export function useAdminSchoolEvents(schoolId: string | null) {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery<AdminSchoolEvent[]>({
    queryKey: ["admin_school_events", schoolId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("school_events")
        .select("*")
        .eq("school_id", schoolId!)
        .gte("start_time", thirtyDaysAgo.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as AdminSchoolEvent[];
    },
    enabled: !!schoolId,
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<AdminSchoolEvent> & { title: string; start_time: string }) => {
      if (!schoolId || !user) throw new Error("Missing context");
      const isNew = !input.id;

      const payload: any = {
        school_id: schoolId,
        title: input.title,
        location: input.location ?? null,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        all_day: input.all_day ?? false,
        category: input.category ?? null,
        source: "manual",
        updated_by: user.id,
        ...(isNew ? { created_by: user.id } : {}),
      };

      let result;
      if (isNew) {
        const { data, error } = await supabase.from("school_events").insert(payload).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.from("school_events").update(payload).eq("id", input.id!).select().single();
        if (error) throw error;
        result = data;
      }

      await supabase.from("audit_log").insert({
        school_id: schoolId,
        actor_user_id: user.id,
        action: isNew ? "CREATE_EVENT" : "UPDATE_EVENT",
        entity: "school_events",
        entity_id: result.id,
      } as any);

      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_school_events", schoolId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!schoolId || !user) throw new Error("Missing context");
      const { error } = await supabase.from("school_events").delete().eq("id", id);
      if (error) throw error;

      await supabase.from("audit_log").insert({
        school_id: schoolId,
        actor_user_id: user.id,
        action: "DELETE_EVENT",
        entity: "school_events",
        entity_id: id,
      } as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_school_events", schoolId] }),
  });

  const upcomingCount = (query.data ?? []).filter(
    (e) => {
      const d = new Date(e.start_time);
      const now = new Date();
      const inWeek = new Date();
      inWeek.setDate(inWeek.getDate() + 7);
      return d >= now && d <= inWeek;
    }
  ).length;

  return {
    events: query.data ?? [],
    upcomingCount,
    isLoading: query.isLoading,
    upsert: upsert.mutateAsync,
    isUpserting: upsert.isPending,
    remove: remove.mutateAsync,
    isRemoving: remove.isPending,
  };
}
