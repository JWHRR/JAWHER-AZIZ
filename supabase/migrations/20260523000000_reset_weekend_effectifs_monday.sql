-- =============================================================
-- AUTO-RESET weekend_effectifs every Monday at 00:01 UTC
--
-- Requires pg_cron extension (enable in Supabase dashboard:
--   Database → Extensions → pg_cron → Enable)
--
-- On Monday the "current weekend" is Thu–3 days ago.
-- We delete those rows so the slate is clean for the next week.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old schedule if it exists (idempotent re-run)
SELECT cron.unschedule('reset-weekend-effectifs')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reset-weekend-effectifs'
);

-- Schedule: every Monday at 00:01 UTC
SELECT cron.schedule(
  'reset-weekend-effectifs',
  '1 0 * * 1',
  $$
    DELETE FROM public.weekend_effectifs
    WHERE semaine_du = (CURRENT_DATE - INTERVAL '4 days')::DATE;
  $$
);
