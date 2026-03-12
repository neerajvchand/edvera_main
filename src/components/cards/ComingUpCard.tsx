import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X, MapPin, Calendar } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useComingUp } from "@/hooks/useComingUp";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const MAX_VISIBLE = 2;

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}

export function ComingUpCard() {
  const { t } = useLanguage();
  const { school } = useSelectedChild();
  const { data: events = [], isLoading } = useComingUp(school?.id, 10);
  const [showAll, setShowAll] = useState(false);

  if (!school) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <h3 className="font-semibold text-foreground mb-3">{t('comingUp')}</h3>
        <p className="text-sm text-muted-foreground">Add a profile to see upcoming dates.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <h3 className="font-semibold text-foreground mb-3">{t('comingUp')}</h3>
        <Skeleton className="h-10 w-full mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <h3 className="font-semibold text-foreground mb-3">{t('comingUp')}</h3>
        <p className="text-sm text-muted-foreground">{t('noUpcomingEvents')}</p>
      </div>
    );
  }

  const visible = events.slice(0, MAX_VISIBLE);
  const remaining = events.length - MAX_VISIBLE;

  return (
    <div id="coming-up-card" className="pulse-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <h3 className="font-semibold text-foreground mb-2">{t('comingUp')}</h3>
      <div className="space-y-1.5">
        {visible.map(event => (
          <div key={event.id} className="py-1.5">
            <div className="text-sm font-medium text-foreground">
              {formatEventDate(event.start_time)} • {event.title}
            </div>
            {event.description && (
              <div className="text-xs text-muted-foreground truncate">{event.description}</div>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-sm text-primary font-medium py-1 text-left flex items-center gap-1"
          >
            +{remaining} more <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* All events bottom sheet — portaled to body */}
      {showAll && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50 animate-in fade-in duration-200"
          onClick={() => setShowAll(false)}
        >
          <div
            className="bg-card w-full max-h-[85vh] rounded-t-3xl p-6 overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-foreground mb-1">{t('comingUp')}</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {events.length} upcoming event{events.length !== 1 ? 's' : ''}
            </p>

            <div className="space-y-0.5">
              {events.map((event, i) => {
                const dateLabel = formatEventDate(event.start_time);
                const prevDate = i > 0 ? formatEventDate(events[i - 1].start_time) : null;
                const showDateHeader = dateLabel !== prevDate;

                return (
                  <div key={event.id}>
                    {showDateHeader && (
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3 pb-1.5 first:pt-0">
                        {dateLabel}
                      </div>
                    )}
                    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-secondary/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{event.title}</div>
                        {event.location && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" /> {event.location}
                          </div>
                        )}
                        {event.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {school && (
              <div className="text-xs text-muted-foreground mt-5 mb-4">
                {school.name}
              </div>
            )}

            <button
              onClick={() => setShowAll(false)}
              className="w-full py-3 bg-foreground text-background font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              {t('close')}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
