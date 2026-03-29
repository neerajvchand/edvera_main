/** Centralized helpers for auth mode (parent | staff) persistence. */

export type AuthMode = "parent" | "staff";
// TODO: Platform role routing goes here — reserve 'platform' for future super-admin mode

const AUTH_MODE_KEY = "edvera_auth_mode";
const DEFAULT_VIEW_KEY = "edvera_default_view";

export function getAuthMode(): AuthMode {
  const val = localStorage.getItem(AUTH_MODE_KEY);
  return val === "staff" ? "staff" : "parent";
}

export function setAuthMode(mode: AuthMode) {
  localStorage.setItem(AUTH_MODE_KEY, mode);
}

export function getDefaultView(): AuthMode | null {
  const val = localStorage.getItem(DEFAULT_VIEW_KEY);
  if (val === "staff" || val === "parent") return val;
  return null;
}

export function setDefaultView(mode: AuthMode) {
  localStorage.setItem(DEFAULT_VIEW_KEY, mode);
}

export function clearDefaultView() {
  localStorage.removeItem(DEFAULT_VIEW_KEY);
}
