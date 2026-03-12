-- Create the ingestion orchestrator function
CREATE OR REPLACE FUNCTION public.run_calendar_ingestion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_school record;
  v_attempted int := 0;
  v_succeeded int := 0;
  v_failed int := 0;
  v_last_error text;
  v_admin_key text;
  v_supabase_url text;
BEGIN
  -- Get the admin API key from vault
  SELECT decrypted_secret INTO v_admin_key
  FROM vault.decrypted_secrets
  WHERE name = 'ADMIN_API_KEY'
  LIMIT 1;

  -- Get the current project URL from vault
  SELECT decrypted_secret INTO v_supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  IF v_admin_key IS NULL OR v_supabase_url IS NULL THEN
    INSERT INTO public.ingestion_runs (run_type, schools_attempted, schools_failed, last_error, completed_at)
    VALUES (
      'calendar',
      0,
      0,
      CASE
        WHEN v_admin_key IS NULL THEN 'ADMIN_API_KEY not found in vault'
        ELSE 'SUPABASE_URL not found in vault'
      END,
      now()
    );
    RETURN;
  END IF;

  FOR v_school IN
    SELECT id FROM public.schools WHERE calendar_feed_url IS NOT NULL
  LOOP
    v_attempted := v_attempted + 1;
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/ingest-school-calendar',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Admin-API-Key', v_admin_key
        ),
        body := jsonb_build_object('school_id', v_school.id)
      );
      v_succeeded := v_succeeded + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_last_error := SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.ingestion_runs (run_type, schools_attempted, schools_succeeded, schools_failed, last_error, completed_at)
  VALUES ('calendar', v_attempted, v_succeeded, v_failed, v_last_error, now());
END;
$fn$;
