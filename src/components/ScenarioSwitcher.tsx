import { ScenarioKey } from "@/data/dummyData";
import { useLanguage } from "@/i18n/LanguageContext";

interface ScenarioSwitcherProps {
  currentScenario: ScenarioKey;
  onScenarioChange: (scenario: ScenarioKey) => void;
}

export function ScenarioSwitcher({ currentScenario, onScenarioChange }: ScenarioSwitcherProps) {
  const { t } = useLanguage();
  
  const scenarioLabels: Record<ScenarioKey, { label: string; emoji: string }> = {
    normal: { label: t('normalDay'), emoji: "🟢" },
    minimum: { label: t('minimumDay'), emoji: "⚠️" },
    noschool: { label: t('noSchool'), emoji: "🏠" }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3 mb-4">
      <p className="text-xs font-medium text-muted-foreground mb-2 text-center">
        {t('testScenarios')}
      </p>
      <div className="flex gap-2">
        {(Object.keys(scenarioLabels) as ScenarioKey[]).map(key => {
          const { label, emoji } = scenarioLabels[key];
          const isActive = currentScenario === key;
          
          return (
            <button
              key={key}
              onClick={() => onScenarioChange(key)}
              className={`
                flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all
                ${isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }
              `}
            >
              <span className="block">{emoji}</span>
              <span className="block mt-0.5">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}