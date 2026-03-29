import { RefreshCw } from 'lucide-react';
import { useLanguage } from "@/i18n/LanguageContext";

interface AppFooterProps {
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function AppFooter({ lastUpdated, onRefresh, isRefreshing }: AppFooterProps) {
  const { t } = useLanguage();
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary/50 border-t border-border">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>{t('lastUpdated')}: {lastUpdated}</span>
          <button 
            onClick={onRefresh}
            disabled={isRefreshing}
            className="hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}