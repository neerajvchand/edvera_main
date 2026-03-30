import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermission, type PermissionResource } from "@/hooks/usePermission";
import { useMembership } from "@/context/MembershipContext";
import { PageLoadingSpinner } from "@/components/shared/PageLoadingSpinner";
import type { AppRole } from "@/config/roles";

/* ------------------------------------------------------------------ */
/* RequirePermission                                                   */
/* ------------------------------------------------------------------ */
export function RequirePermission({
  resource,
  action,
  fallback = null,
  children,
}: {
  resource: PermissionResource;
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { isLoading } = useMembership();
  const { can } = usePermission();
  if (isLoading) {
    return <PageLoadingSpinner />;
  }
  if (!can(resource, action)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* RequireRole                                                         */
/* ------------------------------------------------------------------ */
export function RequireRole({
  role: requiredRole,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const { isLoading, role } = useMembership();
  if (isLoading) {
    return <PageLoadingSpinner />;
  }
  if (role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* RequireRoute                                                        */
/* ------------------------------------------------------------------ */
export function RequireRoute({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { canAccessRoute, role } = usePermission();
  const { isLoading } = useMembership();
  if (isLoading) {
    return <PageLoadingSpinner />;
  }
  if (!role || !canAccessRoute(path)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
