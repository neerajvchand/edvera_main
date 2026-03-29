import { X } from 'lucide-react';
import { ActionItem } from "@/types/schoolpulse";
import { formatFullDate } from "@/lib/dateUtils";
import { useLanguage } from "@/i18n/LanguageContext";

interface ActionItemDetailsProps {
  item: ActionItem;
  onClose: () => void;
}

export function ActionItemDetails({ item, onClose }: ActionItemDetailsProps) {
  const { t } = useLanguage();
  
  return (
    <div className="fixed inset-0 bg-card z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('actionRequiredHeader')}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="text-xl font-semibold text-foreground mb-4">{item.title}</h3>
        
        <div className="bg-secondary rounded-lg p-4 mb-5">
          <div className="text-sm text-muted-foreground leading-relaxed">
            {t('itemRequiresAttention')}
          </div>
        </div>
        
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-1">{t('dueBy')}</div>
          <div className="font-semibold text-foreground">{formatFullDate(item.dueDate)}</div>
        </div>
        
        {/* Buttons */}
        <div className="space-y-3">
          <button className="w-full py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors">
            {t('openInParentSquare')}
          </button>
          
          <button className="w-full py-3 bg-card border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition-colors">
            {t('markAsDone')}
          </button>
        </div>
      </div>
    </div>
  );
}