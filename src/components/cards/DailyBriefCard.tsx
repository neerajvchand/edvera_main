import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDailyBrief } from "@/hooks/useDailyBrief";
import { Skeleton } from "@/components/ui/skeleton";

export function DailyBriefCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();
  const { brief, sources, reasons, loading, error } = useDailyBrief();

  if (!brief && !loading && !error) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <h3 className="font-semibold text-foreground mb-3">{t('dailyBrief')}</h3>
        <p className="text-sm text-muted-foreground">Add a profile to generate your daily brief.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <h3 className="font-semibold text-foreground mb-3">{t('dailyBrief')}</h3>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-2" />
        <Skeleton className="h-4 w-4/6 mb-3" />
        <Skeleton className="h-3 w-48" />
      </div>
    );
  }

  return (
    <div className="pulse-card animate-fade-in" style={{ animationDelay: "0.15s" }}>
      <h3 className="font-semibold text-foreground mb-3">{t('dailyBrief')}</h3>
      
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {brief}
      </p>
      
      {sources.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          {t('basedOn')}: {sources.join(" • ")}
        </div>
      )}
      
      {reasons.length > 0 && (
        <>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="w-4 h-4" />
                {t('hideDetails')}
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                {t('whySeeing')}
              </>
            )}
          </button>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {t('prioritizationLogic')}
              </p>
              <ul className="space-y-1">
                {reasons.map((reason, index) => (
                  <li key={index} className="text-xs text-muted-foreground">
                    • {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
