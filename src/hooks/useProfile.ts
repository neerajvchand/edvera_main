import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export function useProfile() {
  const { user } = useSession();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) throw error;

      // Auto-create profile if missing
      if (!data) {
        const { data: created, error: insertErr } = await supabase
          .from("profiles")
          .insert({ user_id: userId!, display_name: user?.user_metadata?.full_name ?? null })
          .select()
          .single();
        if (insertErr) throw insertErr;
        return created;
      }

      return data;
    },
  });

  const updateDisplayName = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  const setOnboardingComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ has_completed_onboarding: true } as any)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  const isOnboardingComplete = !!(profile as any)?.has_completed_onboarding;

  return {
    profile,
    isLoading,
    isOnboardingComplete,
    updateDisplayName: updateDisplayName.mutateAsync,
    setOnboardingComplete: setOnboardingComplete.mutateAsync,
  };
}
