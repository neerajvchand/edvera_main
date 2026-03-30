/**
 * Application permission matrix. Route visibility and feature flags by staff role.
 * Aligned with staff_memberships.role (see Supabase migrations).
 */
export const ROLE_PERMISSIONS = {
  district_admin: {
    routes: ["*"],
    dashboard: [
      "metrics",
      "briefs",
      "funding",
      "agent",
      "import_trigger",
    ],
    students: ["view", "export"],
    compliance: ["view", "edit", "sarb", "hearings"],
    funding: ["view"],
    import: ["trigger"],
    settings: ["view", "edit"],
    schoolScope: "district",
  },
  principal: {
    routes: [
      "/dashboard",
      "/students",
      "/compliance",
      "/actions",
      "/reports",
    ],
    dashboard: ["metrics", "briefs"],
    students: ["view"],
    compliance: ["view", "edit"],
    funding: [],
    import: [],
    settings: ["view"],
    schoolScope: "school",
  },
  attendance_clerk: {
    routes: ["/dashboard", "/students", "/compliance", "/actions"],
    dashboard: ["metrics"],
    students: ["view"],
    compliance: ["view", "edit"],
    funding: [],
    import: [],
    settings: [],
    schoolScope: "school",
  },
  counselor: {
    routes: ["/dashboard", "/students", "/compliance", "/actions"],
    dashboard: ["metrics"],
    students: ["view"],
    compliance: ["view"],
    funding: [],
    import: [],
    settings: [],
    schoolScope: "school",
  },
} as const;

export type AppRole = keyof typeof ROLE_PERMISSIONS;

export type PermissionResource = keyof Omit<
  (typeof ROLE_PERMISSIONS)["district_admin"],
  "routes" | "schoolScope"
>;

const APP_ROLES = new Set<string>(Object.keys(ROLE_PERMISSIONS));

export function isAppRole(value: string): value is AppRole {
  return APP_ROLES.has(value);
}

/**
 * True if path is allowed for the given route list (exact, prefix, or wildcard).
 * Student detail lives under /student/:id while nav uses /students.
 */
export function matchesAllowedRoute(
  path: string,
  routes: readonly string[],
): boolean {
  if (routes.includes("*")) return true;
  for (const r of routes) {
    if (r === "*") continue;
    if (path === r || path.startsWith(`${r}/`)) return true;
    if (r === "/students" && path.startsWith("/student/")) return true;
  }
  return false;
}
