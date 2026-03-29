import { useLanguage } from "@/i18n/LanguageContext";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useSchool } from "@/hooks/useSchool";
import { useTodaysSchedule } from "@/hooks/useTodaysSchedule";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(t: string): string {
  const parts = t.split(':');
  const hour = parseInt(parts[0]);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min} ${ampm}`;
}

export function TodaysScheduleCard() {
  const { t } = useLanguage();
  const { selectedChild } = useSelectedChild();
  const { data: school } = useSchool(selectedChild?.school_id);
  const { data: blocks = [], isLoading } = useTodaysSchedule(school?.id);

  if (isLoading || !school) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <h3 className="font-semibold text-foreground mb-3">Today's Schedule</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <h3 className="font-semibold text-foreground mb-3">Today's Schedule</h3>
        <p className="text-sm text-muted-foreground">No schedule for today.</p>
      </div>
    );
  }

  return (
    <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Today's Schedule</h3>
      </div>
      <div className="space-y-0.5">
        {blocks.map((block, i) => {
          const isBreak = ['Recess', 'Lunch', 'Lunch/Dismissal'].includes(block.label);
          const isDismissal = block.label === 'Dismissal';
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between py-1.5 px-2 rounded-lg text-sm",
                isBreak && "bg-secondary/50",
                isDismissal && "border-t border-border mt-1 pt-2"
              )}
            >
              <span className={cn(
                "font-medium",
                isBreak ? "text-muted-foreground" : "text-foreground",
                isDismissal && "font-semibold"
              )}>
                {block.label}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatTime(block.start_local)} – {formatTime(block.end_local)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
