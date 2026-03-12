import { cn } from "@/lib/utils";
import { Check, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";
import type { TierChecklistItem } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const SOURCE_STYLES: Record<string, { bg: string; text: string }> = {
  action: { bg: "bg-blue-50", text: "text-blue-600" },
  document: { bg: "bg-emerald-50", text: "text-emerald-600" },
  manual: { bg: "bg-gray-50", text: "text-gray-600" },
  approval: { bg: "bg-purple-50", text: "text-purple-600" },
};

/* ------------------------------------------------------------------ */
/* EC Citation Linking                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parses text containing EC citations (e.g. "EC §48260.5") and
 * renders them as clickable links to the Legal Reference page.
 */
function renderWithCitationLinks(text: string): React.ReactNode {
  // Match patterns like "EC §48260.5" or "EC §48262"
  const regex = /(EC\s*§\s*(\d+(?:\.\d+)?))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add linked citation
    const fullCitation = match[1];
    const sectionNum = match[2];
    parts.push(
      <Link
        key={match.index}
        to={`/reference/education-code#section-${sectionNum}`}
        className="text-emerald-600 hover:text-emerald-700 underline decoration-dotted underline-offset-2 transition-colors"
        title={`View ${fullCitation} in Legal Reference`}
      >
        {fullCitation}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ChecklistItem({ item }: { item: TierChecklistItem }) {
  const src = SOURCE_STYLES[item.source] ?? SOURCE_STYLES.manual;
  return (
    <div className="flex items-start gap-2.5 py-2">
      {/* Circle indicator */}
      <div className="shrink-0 mt-0.5">
        {item.completed ? (
          <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        )}
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-tight",
            item.completed ? "text-gray-900 font-medium" : "text-gray-400"
          )}
        >
          {renderWithCitationLinks(item.label)}
        </p>
        {item.completed && (
          <div className="flex items-center gap-2 mt-1">
            {item.completedAt && (
              <span className="text-xs text-gray-400">
                {formatDate(item.completedAt)}
              </span>
            )}
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                src.bg,
                src.text
              )}
            >
              {item.source}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TierColumn({
  title,
  items,
  tierIndex,
  currentTier,
}: {
  title: string;
  items: TierChecklistItem[];
  tierIndex: number;
  currentTier: number;
}) {
  const allComplete = items.length > 0 && items.every((i) => i.completed);
  const someComplete = items.some((i) => i.completed);
  const isActive = tierIndex === currentTier;
  const isReached = tierIndex <= currentTier;

  let dotColor = "bg-gray-300"; // not reached
  if (allComplete) dotColor = "bg-emerald-500";
  else if (isActive && someComplete) dotColor = "bg-yellow-400";
  else if (isActive && !someComplete) dotColor = "bg-red-400";

  return (
    <div
      className={cn(
        "flex-1 min-w-0",
        !isReached && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotColor)} />
        <h4 className="text-sm font-semibold text-gray-900 truncate">
          {title}
        </h4>
      </div>
      <div className="space-y-0">
        {items.map((item) => (
          <ChecklistItem key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Card                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  tierChecklist: CaseWorkspaceResponse["tierChecklist"];
  currentTier: number;
}

export function TierChecklistCard({ tierChecklist, currentTier }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Compliance Checklist
        </h3>

        {/* Three columns on desktop, stacked on mobile */}
        <div className="flex flex-col md:flex-row gap-6">
          <TierColumn
            title="Tier 1 — Letter"
            items={tierChecklist.tier1}
            tierIndex={1}
            currentTier={currentTier}
          />
          <TierColumn
            title="Tier 2 — Conference"
            items={tierChecklist.tier2}
            tierIndex={2}
            currentTier={currentTier}
          />
          <TierColumn
            title="Tier 3 — SARB"
            items={tierChecklist.tier3}
            tierIndex={3}
            currentTier={currentTier}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Shield className="h-3.5 w-3.5" />
          <span>
            All compliance documentation is timestamped and stored with audit
            trail integrity.
          </span>
        </div>
      </div>
    </div>
  );
}
