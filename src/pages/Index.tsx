import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { scenarios } from "@/data/dummyData"; // kept for other scenario data
import { getCurrentTime } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { useGuestMode } from "@/hooks/useGuestMode";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useChildren } from "@/hooks/useChildren";
import { getGreeting } from "@/lib/greeting";

// Layout (TodaysScheduleCard removed - schedule is now inside DayDetailsModal)
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";

// Cards
import { TodayGlanceCard } from "@/components/cards/TodayGlanceCard";
import { ActionNeededCard } from "@/components/cards/ActionNeededCard";
import { ComingUpCard } from "@/components/cards/ComingUpCard";
import { DailyBriefCard } from "@/components/cards/DailyBriefCard";
import { InsightCard } from "@/components/cards/InsightCard";
import { QuickHelpCard } from "@/components/cards/QuickHelpCard";
import { AttendanceNoticesCard } from "@/components/cards/AttendanceNoticesCard";
import { BoardBriefsCard } from "@/components/cards/BoardBriefsCard";
import { WelcomeCard } from "@/components/cards/WelcomeCard";
import { OnboardingScreen } from "@/components/screens/OnboardingScreen";
import { AttendanceDebugPanel } from "@/components/debug/AttendanceDebugPanel";

// Modals/Screens
import { DayDetailsModal } from "@/components/modals/DayDetailsModal";

import { SettingsScreen } from "@/components/screens/SettingsScreen";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lastUpdated, setLastUpdated] = useState(getCurrentTime());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { isGuest } = useGuestMode();
  const { profile, isLoading: profileLoading, isOnboardingComplete } = useProfile();
  const { children, isLoading: childrenLoading } = useChildren();
  const { school } = useSelectedChild();

  // Greeting based on school timezone when available
  const greeting = useMemo(() => {
    let now: Date | undefined;
    if (school?.timezone) {
      try {
        const tzStr = new Date().toLocaleString("en-US", { timeZone: school.timezone });
        now = new Date(tzStr);
      } catch { /* fall back to local */ }
    }
    const displayName = !isGuest ? profile?.display_name : undefined;
    return getGreeting({ displayName, now });
  }, [profile?.display_name, isGuest, school?.timezone]);

  // Auto-open settings when navigated back from legal pages
  useEffect(() => {
    if (searchParams.get('settings') === 'open') {
      setShowSettings(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Pull to refresh simulation
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(getCurrentTime());
      setIsRefreshing(false);
      toast({
        title: t('updated'),
        description: t('dataRefreshed'),
        duration: 2000,
      });
    }, 1000);
  }, [toast, t]);

  // Gate: don't render anything until we know the user's state
  const isStateLoading = profileLoading || childrenLoading;

  // First-time user: no active children and onboarding not complete
  // Also triggers when user has removed all children
  const isFirstTime = !isGuest && !isStateLoading && children.length === 0;

  if (isStateLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isFirstTime) {
    return <OnboardingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onSettingsClick={() => setShowSettings(true)} />

      <main className="pt-16 pb-16 px-4 max-w-md mx-auto">
        <div className="space-y-4 pt-4">
          <p className="text-base font-medium text-muted-foreground">{greeting}</p>
          <WelcomeCard />
          <TodayGlanceCard onTap={() => setShowDayDetails(true)} />
          <ActionNeededCard />
          <AttendanceDebugPanel />
          <AttendanceNoticesCard />
          <ComingUpCard />
          <DailyBriefCard />
          <InsightCard />
          <BoardBriefsCard />
          <QuickHelpCard />
        </div>
      </main>

      <AppFooter
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {showDayDetails && (
        <DayDetailsModal onClose={() => setShowDayDetails(false)} />
      )}
      {showSettings && (
        <SettingsScreen onBack={() => setShowSettings(false)} />
      )}
    </div>
  );
};

export default Index;
