export type InsightCategory = 'Attendance' | 'Academics' | 'Wellbeing' | 'Engagement' | 'Safety';
export type InsightSeverity = 'good' | 'neutral' | 'concern';
export type MiniVizType = 'bullet' | 'sparkline' | 'gauge' | 'none';

export interface PrimaryMetric {
  label: string;
  value: number;
  unit: string;
  delta?: number;
  delta_unit?: string;
}

export interface ComparisonMetric {
  label: string;
  value: number;
  unit: string;
}

export interface TrendPoint {
  year: string;
  value: number;
}

export interface CompareData {
  similar?: number;
  district?: number;
  county?: number;
  bayArea?: number;
}

export interface ChecklistItem {
  label: string;
  status: 'complete' | 'incomplete' | 'not_started';
  due?: string;
}

export interface SubgroupDatum {
  label: string;
  value: number | null;       // null = suppressed
  suppressed?: boolean;
}

/** Per-year snapshot for year-toggle support */
export interface YearSnapshot {
  reporting_year: string;
  primary_metric: PrimaryMetric;
  comparison?: ComparisonMetric;
  subgroup_data?: SubgroupDatum[];
}

export interface InsightPayload {
  // Time-accuracy fields
  reporting_year?: string;
  previous_year_value?: number;
  current_year_value?: number;
  delta_value?: number;

  // Structured fields
  primary_metric?: PrimaryMetric;
  comparison?: ComparisonMetric;
  subgroup_data?: SubgroupDatum[];
  meaning_bullets?: string[];
  parent_actions?: string[];
  questions?: string[];
  checklist_items?: ChecklistItem[];
  suppressed_note?: string;

  /** Multiple year snapshots for year-toggle */
  year_snapshots?: YearSnapshot[];

  // Legacy fields (backward compat)
  metric_value?: number;
  metric_label?: string;
  comparison_value?: number;
  comparison_label?: string;
  trend?: TrendPoint[];
  compare?: CompareData;
  what_it_means?: string[];
  what_you_can_do?: string[];
  questions_to_ask?: string[];
}

export interface CurrentInsight {
  insight_id: string;
  insight_key: string;
  category: InsightCategory;
  severity: InsightSeverity;
  headline: string;
  context: string;
  why_this: string;
  source: string;
  last_updated: string;
  mini_viz_type: MiniVizType;
  payload: InsightPayload;
  priority_score: number;
  school_insight_id: string;
}
