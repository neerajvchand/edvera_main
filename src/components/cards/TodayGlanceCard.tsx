import { ChevronRight, AlertTriangle, Home } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useTodayGlance } from "@/hooks/useTodayGlance";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TodayGlanceCardProps {
  onTap: () => void;
}

type DayTypeKey = 'regular' | 'minimum' | 'noschool' | 'weekend' | 'emergency';

interface DayTypeConfig {
  emoji: string;
  label: string;
  showTimes: boolean;
  pillClass: string;
  cardClass: string;
}

const dayTypeMap: Record<string, DayTypeKey> = {
  'Normal Day': 'regular',
  'Regular': 'regular',
  'Minimum Day': 'minimum',
  'No School': 'noschool',
  'Holiday': 'noschool',
  'Weekend': 'weekend',
  'Emergency': 'emergency',
};

const getDayTypeConfig = (dayType: string, t: (key: string) => string): DayTypeConfig => {
  const key = dayTypeMap[dayType] || 'regular';
  const configs: Record<DayTypeKey, DayTypeConfig> = {
    regular: { emoji: "🟢", label: t('normalDay'), showTimes: true, pillClass: "status-pill-normal", cardClass: "" },
    minimum: { emoji: "⚠️", label: t('minimumDay'), showTimes: true, pillClass: "status-pill-minimum", cardClass: "" },
    noschool: { emoji: "🏠", label: t('noSchool'), showTimes: false, pillClass: "status-pill-noschool", cardClass: "" },
    weekend: { emoji: "🏠", label: t('noSchool'), showTimes: false, pillClass: "bg-muted border border-border text-muted-foreground", cardClass: "bg-muted/50" },
    emergency: { emoji: "🚨", label: "Emergency", showTimes: true, pillClass: "status-pill-noschool animate-pulse", cardClass: "border-destructive" },
  };
  return configs[key];
};

function formatTime(t: string | null): string {
  if (!t) return '—';
  const parts = t.split(':');
  const hour = parseInt(parts[0]);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min} ${ampm}`;
}

export function TodayGlanceCard({ onTap }: TodayGlanceCardProps) {
  const { t } = useLanguage();
  const { school } = useSelectedChild();
  const { data: glance, isLoading, error } = useTodayGlance(school?.id);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  if (!school) {
    return (
      <div className="pulse-card animate-fade-in">
        <h3 className="text-base font-semibold text-foreground mb-2">{t('todayAtGlance')}</h3>
        <p className="text-sm text-muted-foreground">Add a profile to see today's schedule.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="pulse-card animate-fade-in">
        <div className="text-xs text-muted-foreground mb-2">{t('todayAtGlance')}</div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-3" />
        <div className="space-y-1 mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pulse-card animate-fade-in border-destructive">
        <div className="text-xs text-muted-foreground mb-2">{t('todayAtGlance')}</div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">Unable to load schedule data</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {error instanceof Error ? error.message : 'Please try again later'}
        </p>
      </div>
    );
  }

  if (!glance) return null;

  const config = getDayTypeConfig(glance.day_type, t);
  const startFormatted = formatTime(glance.start_time);
  const pickupFormatted = formatTime(glance.pickup_time);
  const hasValidTimes = config.showTimes && glance.start_time && glance.pickup_time;

  return (
    <button
      onClick={onTap}
      className={cn("w-full pulse-card text-left animate-fade-in !py-3.5 !px-4", config.cardClass)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground mb-2">{t('todayAtGlance')}</h3>
          <div className="mb-2">
            <span className={cn("status-pill", config.pillClass)}>
              {config.emoji} {config.label}
              {glance.day_type === 'Minimum Day' && (
                <Badge variant="secondary" className="ml-2 text-xs">EARLY</Badge>
              )}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mb-2">
            {formattedDate} • {school.name}
          </div>
          {hasValidTimes ? (
            <div className="space-y-0.5 mb-1">
              <div className="text-sm">
                <span className="font-semibold text-foreground">{t('start')}: {startFormatted}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground">{t('pickup')}: {pickupFormatted}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Home className="w-4 h-4" />
              <span className="text-sm">No school times today</span>
            </div>
          )}
          {glance.notes && (
            <div className="text-xs text-muted-foreground mt-1">{glance.notes}</div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}
