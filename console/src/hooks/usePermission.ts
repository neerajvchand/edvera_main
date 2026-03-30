import { useMemo } from "react";
import { useMembership } from "@/context/MembershipContext";
import {
  matchesAllowedRoute,
  type PermissionResource,
  ROLE_PERMISSIONS,
  type AppRole,
} from "@/config/roles";

/**
 * Permission helpers scoped to the current user's staff_memberships.role.
 */
export function usePermission() {
  const { role } = useMembership();

  return useMemo(() => {
    const can = (resource: PermissionResource, action: string): boolean => {
      if (!role) return false;
      const permissions = ROLE_PERMISSIONS[role];
      if (!permissions) return false;
      const list = permissions[resource] as readonly string[];
      return list.includes(action);
    };

    const canAccessRoute = (path: string): boolean => {
      if (!role) return false;
      const routes = ROLE_PERMISSIONS[role].routes;
      return matchesAllowedRoute(path, routes);
    };

    return { can, canAccessRoute, role } as const;
  }, [role]);
}

export type { AppRole, PermissionResource };
