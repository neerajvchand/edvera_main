import { UpcomingEvent } from "@/types/schoolpulse";
import { formatEventDay, formatFullDate } from "@/lib/dateUtils";

interface ComingUpCardProps {
  events: UpcomingEvent[];
  onEventTap: (event: UpcomingEvent) => void;
}

export function ComingUpCard({ events, onEventTap }: ComingUpCardProps) {
  return (
    <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
      {/* Header */}
      <p className="text-sm font-medium text-muted-foreground mb-3">
        Coming Up
      </p>

      {/* Event list */}
      <div className="space-y-3">
        {events.map(event => {
          const dayLabel = formatEventDay(event.dateTimeStart);
          
          return (
            <div
              key={event.id}
              className="event-item"
              onClick={() => onEventTap(event)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onEventTap(event)}
            >
              <p className="text-sm font-medium text-foreground">
                {dayLabel} — {event.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {event.plainSummary}
              </p>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No upcoming events in the next few days.
        </p>
      )}
    </div>
  );
}
