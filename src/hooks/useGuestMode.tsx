import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface GuestModeContextType {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const GuestModeContext = createContext<GuestModeContextType>({
  isGuest: false,
  enterGuestMode: () => {},
  exitGuestMode: () => {},
});

export function GuestModeProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const enterGuestMode = useCallback(() => setIsGuest(true), []);
  const exitGuestMode = useCallback(() => setIsGuest(false), []);

  return (
    <GuestModeContext.Provider value={{ isGuest, enterGuestMode, exitGuestMode }}>
      {children}
    </GuestModeContext.Provider>
  );
}

export function useGuestMode() {
  return useContext(GuestModeContext);
}
