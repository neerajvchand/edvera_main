export type ActionCategory = 'alert' | 'task' | 'attendance' | 'note';

export type ActionPriority = 'urgent' | 'soon' | 'fyi';

export interface ActionItem {
  id: string;
  category: ActionCategory;
  title: string;
  description?: string;
  dueAt?: string;        // ISO datetime
  eventAt?: string;      // ISO datetime
  createdAt: string;     // ISO datetime
  expiresAt?: string;    // ISO datetime, nullable
  snoozedUntil?: string; // ISO datetime, nullable
  source: {
    kind: 'user' | 'calendar' | 'public' | 'district' | 'system';
    label?: string;      // e.g. "School Calendar", "User Note"
    url?: string;
    confidence?: number; // 0..1
  };
  childId?: string;      // optional for future multi-child
  status: 'open' | 'done' | 'dismissed';
  severity?: number;     // 0..1 for alerts (gas leak = 1)
  requiresAction?: boolean;
  tags?: string[];
  // computed fields:
  score?: number;        // 0..100
  priority?: ActionPriority;
}
