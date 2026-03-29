import { useLanguage } from "@/i18n/LanguageContext";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useTodayGlance } from "@/hooks/useTodayGlance";
import { useTodaysSchedule } from "@/hooks/useTodaysSchedule";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DayDetailsModalProps {
  onClose: () => void;
}

function formatTime(t: string | null): string {
  if (!t) return '—';
  const parts = t.split(':');
  const hour = parseInt(parts[0]);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min} ${ampm}`;
}

const dayTypeStyles: Record<string, string> = {
  'Normal Day': 'bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-border))]',
  'Regular': 'bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-border))]',
  'Minimum Day': 'bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-border))]',
  'No School': 'bg-[hsl(var(--status-urgent-bg))] border border-[hsl(var(--status-urgent-border))]',
  'Weekend': 'bg-muted border border-border',
};

export function DayDetailsModal({ onClose }: DayDetailsModalProps) {
  const { t } = useLanguage();
  const { school } = useSelectedChild();
  const { data: glance } = useTodayGlance(school?.id);
  const { data: blocks = [], isLoading: blocksLoading } = useTodaysSchedule(school?.id);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const highlightClass = glance
    ? dayTypeStyles[glance.day_type] || dayTypeStyles['Normal Day']
    : '';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-h-[85vh] rounded-t-3xl p-6 overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-foreground mb-1">{t('todaysSchedule')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{formattedDate}</p>

        {glance ? (
          <div className={cn("rounded-xl p-4 mb-5", highlightClass)}>
            <div className="text-lg font-semibold text-foreground">{glance.day_type}</div>
            {glance.pickup_time && (
              <div className="text-sm text-muted-foreground">
                {t('pickupAt')} {formatTime(glance.pickup_time)}
              </div>
            )}
            {glance.notes && (
              <div className="text-sm text-muted-foreground mt-1">{glance.notes}</div>
            )}
          </div>
        ) : (
          <Skeleton className="h-20 w-full mb-5 rounded-xl" />
        )}

        {blocksLoading ? (
          <div className="space-y-2 mb-5">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : blocks.length > 0 ? (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Bell Schedule
            </h3>
            <div className="space-y-0.5">
              {blocks.map((block, i) => {
                const isBreak = ['Recess', 'Lunch', 'Lunch/Dismissal'].includes(block.label);
                const isDismissal = block.label === 'Dismissal';
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between py-2 px-3 rounded-lg text-sm",
                      isBreak && "bg-secondary/50",
                      isDismissal && "border-t border-border mt-1 pt-3"
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
                      {block.start_local === block.end_local
                        ? formatTime(block.start_local)
                        : `${formatTime(block.start_local)} – ${formatTime(block.end_local)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {school && (
          <div className="text-xs text-muted-foreground mb-6">
            {school.name}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-foreground text-background font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
