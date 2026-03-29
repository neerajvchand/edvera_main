import { DayInfo, School, DayType } from "@/types/schoolpulse";
import { formatShortDate } from "@/lib/dateUtils";

interface DayAtGlanceCardProps {
  dayInfo: DayInfo;
  school: School;
  onTap: () => void;
}

const dayTypeConfig: Record<DayType, { emoji: string; label: string; pillClass: string }> = {
  normal: {
    emoji: "🟢",
    label: "Normal Day",
    pillClass: "status-pill-normal"
  },
  minimum: {
    emoji: "⚠️",
    label: "Minimum Day",
    pillClass: "status-pill-minimum"
  },
  noschool: {
    emoji: "🏠",
    label: "No School",
    pillClass: "status-pill-noschool"
  }
};

export function DayAtGlanceCard({ dayInfo, school, onTap }: DayAtGlanceCardProps) {
  const config = dayTypeConfig[dayInfo.type];
  const formattedDate = formatShortDate(dayInfo.date);

  return (
    <div
      className="pulse-card cursor-pointer animate-fade-in"
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onTap()}
    >
      {/* Date line */}
      <p className="text-sm font-medium text-muted-foreground">
        Today • {formattedDate}
      </p>
      
      {/* School name */}
      <p className="text-xs font-medium text-muted-foreground mb-3">
        {school.name}
      </p>

      {/* Day type pill */}
      <div className="mb-4">
        <span className={`status-pill ${config.pillClass}`}>
          {config.emoji} {config.label}
        </span>
      </div>

      {/* Time information */}
      <div className="space-y-1 text-sm text-foreground">
        <p>
          Pickup: <span className="font-semibold">{dayInfo.pickupTime}</span>
        </p>
        <p>
          Start: <span className="font-semibold">{dayInfo.startTime}</span>
        </p>
      </div>

      {/* Notes */}
      {dayInfo.notes && (
        <p className="text-sm text-muted-foreground mt-3">
          {dayInfo.notes}
        </p>
      )}
    </div>
  );
}
