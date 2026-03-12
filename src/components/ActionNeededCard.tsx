import { ActionItem, UrgencyLevel } from "@/types/schoolpulse";
import { formatDueDate, formatFullDate } from "@/lib/dateUtils";

interface ActionNeededCardProps {
  actionItems: ActionItem[];
  onItemTap: (item: ActionItem) => void;
}

function getOverallStatus(items: ActionItem[]): {
  emoji: string;
  text: string;
  subtitle?: string;
  containerClass: string;
} {
  const openItems = items.filter(item => item.status === "open");
  
  if (openItems.length === 0) {
    return {
      emoji: "✅",
      text: "Nothing urgent",
      subtitle: "You're all set. No actions needed today.",
      containerClass: "status-container-success"
    };
  }

  const hasAction = openItems.some(item => item.urgency === "action");
  
  if (hasAction) {
    return {
      emoji: "🔴",
      text: "Action needed",
      containerClass: "status-container-urgent"
    };
  }

  const count = openItems.length;
  return {
    emoji: "⚠️",
    text: `${count} thing${count > 1 ? "s" : ""} to note`,
    containerClass: "status-container-warning"
  };
}

export function ActionNeededCard({ actionItems, onItemTap }: ActionNeededCardProps) {
  const openItems = actionItems.filter(item => item.status === "open");
  const status = getOverallStatus(actionItems);

  return (
    <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.05s" }}>
      {/* Header */}
      <p className="text-sm font-medium text-muted-foreground mb-3">
        Do I need to do anything?
      </p>

      {/* Status container */}
      <div className={`rounded-xl p-4 ${status.containerClass}`}>
        {/* Status header */}
        <p className="text-base font-semibold text-foreground flex items-center gap-2">
          <span>{status.emoji}</span>
          <span>{status.text}</span>
        </p>

        {/* Subtitle for empty state */}
        {status.subtitle && (
          <p className="text-sm text-muted-foreground mt-1">
            {status.subtitle}
          </p>
        )}

        {/* Action items */}
        {openItems.length > 0 && (
          <div className="mt-3 space-y-2">
            {openItems.map(item => (
              <div
                key={item.id}
                className="action-item-box"
                onClick={() => onItemTap(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onItemTap(item)}
              >
                <p className="text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Due {formatDueDate(item.dueDate)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
