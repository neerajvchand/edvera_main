import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export interface SchoolContact {
  label: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  sortOrder: number;
}

export interface ScheduleException {
  date: string;
  isMinimumDay: boolean;
  note: string;
}

export interface BellScheduleRules {
  wednesdayMinimumDay?: boolean;
  exceptions?: ScheduleException[];
}

export interface QuickLink {
  label: string;
  url: string;
  category: string;
  sortOrder: number;
}

export interface SchoolProfile {
  id: string;
  school_id: string;
  contacts: SchoolContact[];
  bell_schedule_rules: BellScheduleRules;
  quick_links: QuickLink[];
  updated_at: string;
}

export function useSchoolProfile(schoolId: string | null) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery<SchoolProfile | null>({
    queryKey: ["school_profile", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;

      const { data, error } = await supabase
        .from("school_profiles")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Auto-create if missing
        const { data: created, error: createErr } = await supabase
          .from("school_profiles")
          .insert({ school_id: schoolId } as any)
          .select()
          .single();

        if (createErr) throw createErr;
        return formatProfile(created);
      }

      return formatProfile(data);
    },
    enabled: !!schoolId,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Pick<SchoolProfile, "contacts" | "bell_schedule_rules" | "quick_links">>) => {
      if (!schoolId || !user) throw new Error("Missing context");

      const { error } = await supabase
        .from("school_profiles")
        .update({ ...updates, updated_by: user.id } as any)
        .eq("school_id", schoolId);

      if (error) throw error;

      // Audit log
      await supabase.from("audit_log").insert({
        school_id: schoolId,
        actor_user_id: user.id,
        action: "UPDATE_PROFILE",
        entity: "school_profiles",
        entity_id: schoolId,
        meta: { fields: Object.keys(updates) },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school_profile", schoolId] });
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateProfile: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
  };
}

function formatProfile(data: any): SchoolProfile {
  return {
    id: data.id,
    school_id: data.school_id,
    contacts: (data.contacts as SchoolContact[]) ?? [],
    bell_schedule_rules: (data.bell_schedule_rules as BellScheduleRules) ?? {},
    quick_links: (data.quick_links as QuickLink[]) ?? [],
    updated_at: data.updated_at,
  };
}
