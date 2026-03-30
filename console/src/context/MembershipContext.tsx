import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/hooks/useSession";
import {
  getStaffMembership,
  type StaffMembershipRow,
} from "@/services/profiles/getStaffMembership";
import {
  isAppRole,
  type AppRole,
  ROLE_PERMISSIONS,
} from "@/config/roles";

/* ------------------------------------------------------------------ */
/* Context value                                                       */
/* ------------------------------------------------------------------ */

export interface MembershipContextValue {
  membership: StaffMembershipRow | null;
  isLoading: boolean;
  error: Error | null;
  role: AppRole | null;
  districtId: string | null;
  schoolId: string | null;
  isDistrictAdmin: boolean;
  schoolScope: "district" | "school" | null;
  refetch: () => Promise<void>;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user, loading: sessionLoading } = useSession();
  const [membership, setMembership] = useState<StaffMembershipRow | null>(null);
  /** Resolves membership fetch for the current session (avoids flash before first effect). */
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (sessionLoading) return;
    if (!user?.id) {
      setMembership(null);
      setError(null);
      setFetchState("done");
      return;
    }

    setFetchState("loading");
    setError(null);
    try {
      const row = await getStaffMembership(user.id);
      setMembership(row);
    } catch (e) {
      setMembership(null);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFetchState("done");
    }
  }, [user?.id, sessionLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const membershipPending =
    !sessionLoading && !!user?.id && fetchState !== "done";
  const isLoading = sessionLoading || membershipPending;

  const role: AppRole | null = useMemo(() => {
    if (!membership?.role) return null;
    return isAppRole(membership.role) ? membership.role : null;
  }, [membership?.role]);

  const districtId = membership?.district_id ?? null;
  const schoolId = membership?.school_id ?? null;

  const isDistrictAdmin = role === "district_admin";

  const schoolScope = useMemo((): "district" | "school" | null => {
    if (!role) return null;
    const scope = ROLE_PERMISSIONS[role].schoolScope;
    return scope === "district" || scope === "school" ? scope : null;
  }, [role]);

  const value = useMemo<MembershipContextValue>(
    () => ({
      membership,
      isLoading,
      error,
      role,
      districtId,
      schoolId,
      isDistrictAdmin,
      schoolScope,
      refetch: load,
    }),
    [
      membership,
      isLoading,
      error,
      role,
      districtId,
      schoolId,
      isDistrictAdmin,
      schoolScope,
      load,
    ],
  );

  return (
    <MembershipContext.Provider value={value}>
      {children}
    </MembershipContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useMembership(): MembershipContextValue {
  const ctx = useContext(MembershipContext);
  if (!ctx) {
    throw new Error("useMembership must be used within MembershipProvider");
  }
  return ctx;
}
