import { X } from 'lucide-react';
import { UpcomingEvent } from "@/types/schoolpulse";
import { formatFullDate } from "@/lib/dateUtils";
import { useLanguage } from "@/i18n/LanguageContext";

interface EventDetailsProps {
  event: UpcomingEvent;
  onClose: () => void;
}

export function EventDetails({ event, onClose }: EventDetailsProps) {
  const { t } = useLanguage();
  
  return (
    <div className="fixed inset-0 bg-card z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('eventDetails')}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="text-xl font-semibold text-foreground mb-2">{event.title}</h3>
        
        <div className="text-sm text-muted-foreground mb-5">
          {formatFullDate(event.dateTimeStart)}
        </div>
        
        <div className="bg-secondary rounded-lg p-4 mb-6">
          <div className="font-medium text-sm text-foreground mb-2">{t('details')}</div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {event.plainSummary}
          </div>
        </div>
        
        {/* Source */}
        <div className="text-xs text-muted-foreground mb-6">
          {t('source')}: {event.source}
        </div>
        
        {/* Close Button */}
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