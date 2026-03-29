const AUTH_DEBUG_KEY = "edvera_auth_debug";

function getCurrentUrlParts() {
  if (typeof window === "undefined") {
    return {
      search: new URLSearchParams(),
      hash: new URLSearchParams(),
    };
  }

  return {
    search: new URLSearchParams(window.location.search),
    hash: new URLSearchParams(window.location.hash.replace(/^#/, "")),
  };
}

export function getAuthOrigin(): string {
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();

  // Dev-only hint for production redirect configuration.
  if (import.meta.env.DEV && !siteUrl) {
    authDebug("config:missing-public-site-url-for-production", {
      envVar: "VITE_PUBLIC_SITE_URL",
    });
  }

  if (typeof window !== "undefined" && import.meta.env.DEV) {
    return window.location.origin;
  }

  if (siteUrl) {
    return siteUrl.replace(/\/+$/, "");
  }

  return typeof window !== "undefined" ? window.location.origin : "";
}

export function buildAuthRedirect(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAuthOrigin()}${normalizedPath}`;
}

export function hasAuthCallbackParams(): boolean {
  const { search, hash } = getCurrentUrlParts();
  const type = search.get("type") ?? hash.get("type");

  // Password recovery flow should be handled by reset-password logic, not OAuth callback gating.
  if (type === "recovery") return false;

  return (
    search.has("code") ||
    search.has("error") ||
    search.has("error_description") ||
    hash.has("access_token") ||
    hash.has("refresh_token") ||
    hash.has("error") ||
    hash.has("error_description")
  );
}

export function hasRecoveryParams(): boolean {
  const { search, hash } = getCurrentUrlParts();

  const type = search.get("type") ?? hash.get("type");
  return type === "recovery";
}

export function authDebug(event: string, payload?: unknown) {
  if (!import.meta.env.DEV) return;

  let enabled = false;
  try {
    enabled = localStorage.getItem(AUTH_DEBUG_KEY) === "1";
  } catch {
    enabled = false;
  }

  if (!enabled) return;

  if (payload === undefined) {
    console.info(`[auth] ${event}`);
    return;
  }

  console.info(`[auth] ${event}`, payload);
}
