import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { isDistrictAdmin } from "@/lib/authz";

/** Returns whether the current user is a district admin. */
export function useIsDistrictAdmin(districtId: string | null | undefined) {
  const { user } = useSession();

  return useQuery({
    queryKey: ["is-district-admin", user?.id, districtId],
    queryFn: () => isDistrictAdmin(user!.id, districtId!),
    enabled: !!user && !!districtId,
    staleTime: 5 * 60 * 1000,
  });
}
