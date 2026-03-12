import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useState, useEffect } from "react";

export interface AdminMembership {
  id: string;
  school_id: string;
  role: string;
  is_active: boolean;
  school_name: string;
  timezone: string;
}

export function useAdminMembership() {
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(() =>
    localStorage.getItem("admin_selected_school_id")
  );

  // Invalidate membership cache on auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          queryClient.invalidateQueries({ queryKey: ["staff_memberships"] });
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery<AdminMembership[]>({
    queryKey: ["staff_memberships", user?.id],
    queryFn: async () => {
      // Always get fresh uid at query time
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from("staff_memberships")
        .select("id, school_id, role, is_active, schools!inner(name, timezone)")
        .eq("user_id", currentUser.id)
        .eq("is_active", true);

      if (error) throw error;

      return ((data as any[]) ?? []).map((row: any) => ({
        id: row.id,
        school_id: row.school_id,
        role: row.role,
        is_active: row.is_active,
        school_name: row.schools?.name ?? "Unknown",
        timezone: row.schools?.timezone ?? "America/Los_Angeles",
      }));
    },
    enabled: !!user && !sessionLoading,
    staleTime: 5 * 60 * 1000,
  });

  const memberships = query.data ?? [];

  // Auto-select first school if none selected
  useEffect(() => {
    if (memberships.length > 0 && !selectedSchoolId) {
      const first = memberships[0].school_id;
      setSelectedSchoolId(first);
      localStorage.setItem("admin_selected_school_id", first);
    }
  }, [memberships, selectedSchoolId]);

  const selectSchool = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    localStorage.setItem("admin_selected_school_id", schoolId);
  };

  const activeMembership = memberships.find(
    (m) => m.school_id === selectedSchoolId
  ) ?? memberships[0] ?? null;

  return {
    memberships,
    activeMembership,
    schoolId: activeMembership?.school_id ?? null,
    schoolName: activeMembership?.school_name ?? null,
    role: activeMembership?.role ?? null,
    timezone: activeMembership?.timezone ?? "America/Los_Angeles",
    selectSchool,
    selectedSchoolId,
    isLoading: sessionLoading || query.isLoading,
    isAuthorized: memberships.length > 0,
    error: query.error,
  };
}
