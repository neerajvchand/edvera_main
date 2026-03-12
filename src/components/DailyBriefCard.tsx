import { useState } from "react";
import { DailyBrief } from "@/types/schoolpulse";
import { ChevronRight, ChevronDown } from "lucide-react";

interface DailyBriefCardProps {
  brief: DailyBrief;
}

export function DailyBriefCard({ brief }: DailyBriefCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="pulse-card-info animate-fade-in" style={{ animationDelay: "0.15s" }}>
      {/* Header */}
      <p className="text-sm font-medium text-muted-foreground mb-3">
        Daily Brief
      </p>

      {/* Brief text */}
      <p className="text-base leading-relaxed text-foreground mb-3">
        {brief.text}
      </p>

      {/* Sources */}
      <p className="text-xs text-muted-foreground mb-2">
        Sources: {brief.sources.join(" • ")}
      </p>

      {/* Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
      >
        {isExpanded ? (
          <>
            <ChevronDown className="w-3 h-3" />
            Hide details
          </>
        ) : (
          <>
            <ChevronRight className="w-3 h-3" />
            Why am I seeing this?
          </>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-status-info-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Prioritization logic:
          </p>
          <ul className="space-y-1">
            {brief.reasons.map((reason, index) => (
              <li key={index} className="text-xs text-muted-foreground">
                • {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
