import { supabase } from "@/integrations/supabase/client";

export async function signOut() {
  return supabase.auth.signOut();
}
