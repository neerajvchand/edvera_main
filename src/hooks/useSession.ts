import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { authDebug } from "@/lib/authRedirect";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener BEFORE fetching session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        authDebug("auth-state-change", { event, hasSession: !!newSession, userId: newSession?.user?.id ?? null });
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // Fetch initial session
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!isMounted) return;
        authDebug("session-restored", { hasSession: !!currentSession, userId: currentSession?.user?.id ?? null });
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        authDebug("session-restore-error", error);
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading };
}
