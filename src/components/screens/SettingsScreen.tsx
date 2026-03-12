import { ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from "@/i18n/LanguageContext";
import { languageLabels } from "@/i18n/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsScreenProps {
  onBack: () => void;
  onManageProfiles?: () => void;
}

export function SettingsScreen({ onBack, onManageProfiles }: SettingsScreenProps) {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const currentLabel = languageLabels.find(l => l.id === language)?.label ?? 'English';

  return (
    <div className="fixed inset-0 bg-card z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center">
        <button onClick={onBack} className="mr-3 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{t('settings')}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profiles Section */}
        <div className="border-b border-border">
          <div className="px-5 py-3 bg-secondary">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('profiles')}</div>
          </div>
          <button
            onClick={onManageProfiles}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
          >
            <span className="text-sm text-foreground">{t('manageProfiles')}</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Language Section */}
        <div className="border-b border-border">
          <div className="px-5 py-3 bg-secondary">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('language')}</div>
          </div>
          <div className="px-5 py-4">
            <Select value={language} onValueChange={(val) => setLanguage(val as any)}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <SelectValue>{currentLabel}</SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                {languageLabels.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="border-b border-border">
          <div className="px-5 py-3 bg-secondary">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('notifications')}</div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{t('dailySummary')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{t('onlyUrgent')}</span>
            </label>
          </div>
        </div>

        {/* About Section */}
        <div className="border-b border-border">
          <div className="px-5 py-3 bg-secondary">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('about')}</div>
          </div>
          <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
            <span className="text-sm text-foreground">{t('howItWorks')}</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Legal Section */}
        <div className="border-b border-border">
          <div className="px-5 py-3 bg-secondary">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('legal')}</div>
          </div>
          <button onClick={() => navigate('/legal/privacy-policy')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors border-b border-border">
            <span className="text-sm text-foreground">{t('privacyPolicy')}</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button onClick={() => navigate('/legal/terms-of-service')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors border-b border-border">
            <span className="text-sm text-foreground">{t('termsOfService')}</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
          <button onClick={() => navigate('/legal/data-disclaimer')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
            <span className="text-sm text-foreground">{t('dataAndDisclaimer')}</span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Data & Disclaimer Section */}
        <div className="px-5 py-6">
          <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('dataAndDisclaimer')}</h3>
            <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <li>• {t('disclaimerLine1')}</li>
              <li>• {t('disclaimerLine2')}</li>
              <li>• {t('disclaimerLine3')}</li>
              <li>• {t('disclaimerLine4')}</li>
              <li>• {t('disclaimerLine5')}</li>
              <li>• {t('disclaimerLine6')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
