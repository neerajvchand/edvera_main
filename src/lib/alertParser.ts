const RULES: {
  keywords: RegExp;
  severity: number;
  requiresAction: boolean;
  tag: string;
  title: string;
}[] = [
  {
    keywords: /lockdown|shelter in place|active\s+(shooter|threat)|police|weapon/i,
    severity: 1.0,
    requiresAction: true,
    tag: "safety",
    title: "Safety update from school",
  },
  {
    keywords: /gas\s*leak|evacuate|evacuation|hazmat|smell\s+of\s+gas/i,
    severity: 0.9,
    requiresAction: true,
    tag: "safety",
    title: "Safety update from school",
  },
  {
    keywords: /school\s+closed|closure|cancelled|canceled|no\s+school/i,
    severity: 0.8,
    requiresAction: true,
    tag: "closure",
    title: "School closure update",
  },
  {
    keywords: /early\s+dismissal|minimum\s+day|delayed\s+start|late\s+start/i,
    severity: 0.6,
    requiresAction: true,
    tag: "schedule",
    title: "Schedule change",
  },
  {
    keywords: /power\s+outage|internet\s+down|phone\s+lines/i,
    severity: 0.5,
    requiresAction: false,
    tag: "operations",
    title: "Campus operations update",
  },
];

export function parseAlert(
  text: string,
  now = new Date()
): {
  title: string;
  description: string;
  severity: number;
  requiresAction: boolean;
  dueAt?: string;
  tags: string[];
} {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  let title = "School alert";
  let severity = 0.4;
  let requiresAction = false;
  const tags: string[] = [];

  for (const rule of RULES) {
    if (rule.keywords.test(lower)) {
      severity = rule.severity;
      requiresAction = rule.requiresAction;
      tags.push(rule.tag);
      title = rule.title;
      break;
    }
  }

  if (tags.length === 0) tags.push("info");

  let dueAt: string | undefined;
  if (/\btoday\b/i.test(lower)) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    dueAt = end.toISOString();
  } else if (/\btomorrow\b/i.test(lower)) {
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);
    dueAt = end.toISOString();
  }

  return {
    title,
    description: trimmed,
    severity,
    requiresAction,
    dueAt,
    tags,
  };
}
