/**
 * Shared design tokens for the Edvera console.
 *
 * Extracted from the Lovable reference design (EdveraDashboard.jsx).
 * All pages should import from here instead of hardcoding values.
 *
 * Font sizes use clamp() for responsive scaling on 1440px+ screens.
 */

/* ------------------------------------------------------------------ */
/* Color palette                                                       */
/* ------------------------------------------------------------------ */

export const COLORS = {
  /** Navy primary — topbar, primary buttons, metric accent */
  primary: "#1e3a5f",
  primaryFg: "#ffffff",

  /** Foreground text */
  fg: "#1e293b",
  fgMuted: "#64748b",

  /** Borders */
  border: "#e2e8f0",

  /** Status: destructive / urgent */
  destructive: "#ef4444",
  destructiveBg: "rgba(239,68,68,0.1)",

  /** Status: warning / at-risk */
  warning: "#f59e0b",
  warningFg: "#78350f",
  warningBg: "rgba(245,158,11,0.15)",

  /** Status: success / on-track */
  success: "#10b981",
  successBg: "rgba(16,185,129,0.15)",

  /** Tier badge backgrounds & foregrounds */
  tier1Bg: "#fef3c7",
  tier1Fg: "#451a03",
  tier2Bg: "#fee2e2",
  tier2Fg: "#7f1d1d",
  tier3Bg: "#fecaca",
  tier3Fg: "#7f1d1d",
} as const;

/* ------------------------------------------------------------------ */
/* Tailwind class-string tokens                                        */
/* ------------------------------------------------------------------ */

/** Standard white card — use for all panels, tables, metric blocks */
export const CARD = "bg-white border border-gray-200 rounded-lg";

/** Section label — uppercase micro text above a group */
export const SECTION_LABEL =
  "text-[clamp(11px,0.85vw,13px)] font-bold text-gray-400 uppercase tracking-wider";

/** Metric card label (inside a card) */
export const METRIC_LABEL =
  "text-[clamp(11px,0.85vw,13px)] font-semibold text-gray-400 uppercase tracking-wider";

/** Table / column header */
export const TABLE_HEADER =
  "text-[clamp(11px,0.8vw,12px)] font-semibold text-gray-400 uppercase tracking-wider";

/** Primary action button (small, filled navy) */
export const ACTION_BTN =
  "text-[11px] font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-md px-3 py-[7px] transition-colors";

/** Secondary / outline button */
export const SECONDARY_BTN =
  "text-[11px] font-semibold text-gray-600 bg-transparent border border-gray-200 hover:bg-gray-50 rounded-md px-3 py-[7px] transition-colors";

/** Page title — compact, replaces the old text-[28px] */
export const PAGE_TITLE =
  "text-[clamp(15px,1.2vw,18px)] font-semibold text-gray-900";

/** Page subtitle / description */
export const PAGE_SUBTITLE = "text-[13px] text-gray-400";

/** Main content area padding */
export const CONTENT_PADDING = "pt-5 px-6 pb-6";

/** Metric value — large bold number (responsive via Tailwind breakpoints) */
export const METRIC_VALUE =
  "text-[28px] lg:text-[32px] xl:text-[36px] font-bold tracking-tight leading-none";

/** Case row — student name */
export const CASE_NAME =
  "text-[clamp(13px,1vw,15px)] font-semibold text-gray-900";

/** Case row — school/detail subtext */
export const CASE_DETAIL = "text-[clamp(12px,0.9vw,13px)] text-gray-400";

/* ------------------------------------------------------------------ */
/* Tier badges                                                         */
/* ------------------------------------------------------------------ */

export const TIER_BADGE: Record<number, string> = {
  1: "text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900",
  2: "text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-900",
  3: "text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-900",
};

/* ------------------------------------------------------------------ */
/* Status dots & deadline colors                                       */
/* ------------------------------------------------------------------ */

/** Colored dot (w-1.5 h-1.5 rounded-full) */
export const STATUS_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  warn: "bg-amber-400",
  ok: "bg-emerald-400",
};

/** Deadline text color */
export const DEADLINE_COLOR: Record<string, string> = {
  urgent: "text-red-600 font-semibold",
  warn: "text-amber-700 font-semibold",
  ok: "text-emerald-600",
};

/* ------------------------------------------------------------------ */
/* Metric value colors (for inline style={{ color }})                  */
/* ------------------------------------------------------------------ */

export const METRIC_VALUE_COLORS = {
  navy: COLORS.primary,
  amber: COLORS.warningFg,
  red: COLORS.destructive,
  default: COLORS.fg,
} as const;
