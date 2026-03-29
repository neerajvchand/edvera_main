import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export interface Membership {
  id: string;
  user_id: string;
  district_id: string | null;
  school_id: string | null;
  role: string;
  status: string;
  created_at: string;
}

/**
 * Fetch all active memberships for the current user.
 * Used for role context lookup (district view, admin/staff, student mode).
 */
export function useMemberships() {
  const { user } = useSession();

  const query = useQuery<Membership[]>({
    queryKey: ["memberships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching memberships:", error);
        throw error;
      }
      return (data as unknown as Membership[]) ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    memberships: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

/**
 * Upsert a membership row for the current user.
 * Avoids duplicates via the unique constraint (user_id, school_id, role).
 */
export function useUpsertMembership() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: {
      school_id: string;
      district_id: string | null;
      role?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("memberships")
        .upsert(
          {
            user_id: user.id,
            school_id: input.school_id,
            district_id: input.district_id,
            role: input.role ?? "parent",
            status: "active",
          } as any,
          { onConflict: "user_id,school_id,role" }
        );

      if (error) {
        // Log but don't throw — membership is supplementary, not blocking
        console.error("Error upserting membership:", error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memberships", user?.id] });
    },
  });

  return mutation;
}
