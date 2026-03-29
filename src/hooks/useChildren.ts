import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useUpsertMembership } from "@/hooks/useMemberships";

export interface Child {
  id: string;
  parent_id: string;
  school_id: string;
  district_id: string | null;
  display_name: string;
  grade_level: string;
  created_at: string;
}

interface AddChildInput {
  display_name: string;
  grade_level: string;
  school_id: string;
  district_id?: string | null;
}

export function useChildren() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const upsertMembership = useUpsertMembership();

  const childrenQuery = useQuery<Child[]>({
    queryKey: ["children", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching children:", error);
        throw error;
      }
      return (data as unknown as Child[]) ?? [];
    },
    enabled: !!user,
  });

  const addChildMutation = useMutation({
    mutationFn: async (input: AddChildInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("children")
        .insert({
          parent_id: user.id,
          display_name: input.display_name,
          grade_level: input.grade_level,
          school_id: input.school_id,
          ...(input.district_id ? { district_id: input.district_id } : {}),
        } as any)
        .select()
        .single();

      if (error) {
        console.error("Error adding child:", error);
        throw error;
      }
      return data as unknown as Child;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["children", user?.id] });

      // Ensure membership row exists for this school+district
      if (data) {
        const schoolId = (data as any).school_id;
        const districtId = (data as any).district_id;
        if (schoolId) {
          upsertMembership.mutate({
            school_id: schoolId,
            district_id: districtId ?? null,
          });
        }
      }
    },
  });

  const removeChildMutation = useMutation({
    mutationFn: async (childId: string) => {
      const { error } = await supabase
        .from("children")
        .update({ is_active: false, archived_at: new Date().toISOString() } as any)
        .eq("id", childId);

      if (error) {
        console.error("Error archiving child:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children", user?.id] });
    },
  });

  return {
    children: childrenQuery.data ?? [],
    isLoading: childrenQuery.isLoading,
    error: childrenQuery.error,
    addChild: addChildMutation.mutateAsync,
    isAdding: addChildMutation.isPending,
    removeChild: removeChildMutation.mutateAsync,
    isRemoving: removeChildMutation.isPending,
    isAuthenticated: !!user,
  };
}
