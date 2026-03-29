import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { TimelineItem } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DOT_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  orange: "bg-orange-400",
  red: "bg-red-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  gray: "bg-gray-400",
};

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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface Props {
  timeline: TimelineItem[];
}

const DEFAULT_VISIBLE = 10;

export function TimelineCard({ timeline }: Props) {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = expanded
    ? timeline
    : timeline.slice(0, DEFAULT_VISIBLE);
  const remainingCount = timeline.length - DEFAULT_VISIBLE;

  if (timeline.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Timeline
        </h3>
        <p className="text-sm text-gray-400 text-center py-8">
          No timeline events yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Timeline</h3>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />

        <div className="space-y-4">
          {visibleItems.map((item) => {
            const dotColor = DOT_COLORS[item.color] ?? DOT_COLORS.gray;
            return (
              <div key={item.id} className="relative flex gap-3">
                {/* Dot */}
                <div
                  className={cn(
                    "h-[15px] w-[15px] rounded-full shrink-0 mt-0.5 z-10 ring-2 ring-white",
                    dotColor
                  )}
                />
                {/* Content + date */}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show more */}
      {remainingCount > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 mt-4 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Show {remainingCount} more
        </button>
      )}
    </div>
  );
}
