-- =====================================================================
-- RAPPEL QUOTIDIEN 22h30 — réclamations à vérifier
--
-- Chaque soir à 22h30 (heure de Tunis), chaque surveillant actif ayant
-- des réclamations non terminées reçoit une notification lui demandant
-- de vérifier si elles sont réglées, avec l'ancienneté de chacune.
--
-- À exécuter dans le SQL Editor de Supabase, en une seule fois.
-- Relançable sans risque : la planification est remplacée, pas dupliquée.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. pg_cron (planificateur intégré à Postgres)
--    Si cette ligne échoue, activez d'abord pg_cron dans le tableau de
--    bord Supabase : Database > Extensions > pg_cron.
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ---------------------------------------------------------------------
-- 2. La fonction qui envoie les rappels.
--
--    SECURITY DEFINER : elle tourne sans utilisateur connecté, donc
--    en dehors de toute RLS.
--    Elle renvoie le nombre de notifications envoyées.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifier_reclamations_a_verifier()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_surv   RECORD;
    v_count  integer;
    v_oldest integer;
    v_detail text;
    v_sent   integer := 0;
    v_today  date := (now() AT TIME ZONE 'Africa/Tunis')::date;
BEGIN
    FOR v_surv IN
        SELECT ur.user_id
        FROM public.user_roles ur
        JOIN public.profiles p ON p.user_id = ur.user_id
        WHERE ur.role = 'SURVEILLANT'
          AND p.is_active = true
    LOOP
        -- Déjà prévenu aujourd'hui ? On ne renvoie pas.
        -- Rend la fonction rejouable : un double déclenchement du cron,
        -- ou un appel manuel de test, ne produit pas deux notifications.
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = v_surv.user_id
              AND n.title = 'Réclamations à vérifier'
              AND (n.created_at AT TIME ZONE 'Africa/Tunis')::date = v_today
        );

        SELECT count(*),
               COALESCE(max(v_today - (r.created_at AT TIME ZONE 'Africa/Tunis')::date), 0)
        INTO v_count, v_oldest
        FROM public.reclamations r
        WHERE r.created_by = v_surv.user_id
          AND r.status <> 'TERMINEE';

        -- Rien à vérifier : pas de notification inutile.
        CONTINUE WHEN v_count = 0;

        -- Le détail : les 5 plus anciennes, avec leur ancienneté.
        SELECT string_agg(
                 '• ' || t.titre || ' — ' ||
                 CASE WHEN t.jours = 0 THEN 'aujourd''hui'
                      WHEN t.jours = 1 THEN '1 jour'
                      ELSE t.jours || ' jours' END,
                 E'\n' ORDER BY t.jours DESC)
        INTO v_detail
        FROM (
            SELECT r.titre,
                   (v_today - (r.created_at AT TIME ZONE 'Africa/Tunis')::date) AS jours
            FROM public.reclamations r
            WHERE r.created_by = v_surv.user_id
              AND r.status <> 'TERMINEE'
            ORDER BY r.created_at
            LIMIT 5
        ) t;

        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            v_surv.user_id,
            'Réclamations à vérifier',
            'Vous avez ' || v_count ||
            CASE WHEN v_count = 1 THEN ' réclamation non terminée.' ELSE ' réclamations non terminées.' END ||
            ' Merci de vérifier si elles sont réglées.' ||
            CASE WHEN v_oldest > 0
                 THEN ' La plus ancienne date de ' ||
                      CASE WHEN v_oldest = 1 THEN '1 jour.' ELSE v_oldest || ' jours.' END
                 ELSE '' END ||
            E'\n\n' || COALESCE(v_detail, '') ||
            CASE WHEN v_count > 5 THEN E'\n… et ' || (v_count - 5) || ' autre(s).' ELSE '' END,
            '/reclamations'
        );

        v_sent := v_sent + 1;
    END LOOP;

    RETURN v_sent;
END;
$fn$;


-- ---------------------------------------------------------------------
-- 3. Planification à 22h30, heure de Tunis.
--
--    pg_cron raisonne en UTC. La Tunisie est à UTC+1 toute l'année
--    (pas d'heure d'été depuis 2009), donc 22h30 à Tunis = 21h30 UTC.
--    L'expression est calculée plutôt qu'écrite en dur : si le serveur
--    n'était pas en UTC, l'heure resterait juste.
-- ---------------------------------------------------------------------
DO $sched$
DECLARE
    v_hm   text;
    v_expr text;
BEGIN
    SELECT to_char(
             (((now() AT TIME ZONE 'Africa/Tunis')::date + time '22:30')
                AT TIME ZONE 'Africa/Tunis') AT TIME ZONE 'UTC',
             'MI HH24')
    INTO v_hm;                       -- donne « 30 21 »

    v_expr := v_hm || ' * * *';      -- donne « 30 21 * * * »

    -- Remplace la planification existante au lieu d'en ajouter une seconde.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rappel_reclamations_22h30') THEN
        PERFORM cron.unschedule('rappel_reclamations_22h30');
    END IF;

    PERFORM cron.schedule(
        'rappel_reclamations_22h30',
        v_expr,
        'SELECT public.notifier_reclamations_a_verifier();'
    );

    RAISE NOTICE 'Planifié : % (UTC) = 22h30 à Tunis', v_expr;
END
$sched$;


-- ---------------------------------------------------------------------
-- 4. Vérification de la planification.
--    Attendu : schedule = « 30 21 * * * », active = true,
--    et heure_tunis = 22:30.
-- ---------------------------------------------------------------------
SELECT jobname,
       schedule,
       active,
       to_char(
         (((current_date + (split_part(schedule, ' ', 2) || ':' ||
                            split_part(schedule, ' ', 1))::time)
           AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Tunis'),
         'HH24:MI') AS heure_tunis
FROM cron.job
WHERE jobname = 'rappel_reclamations_22h30';


-- ---------------------------------------------------------------------
-- 5. Test immédiat, sans attendre 22h30.
--    Renvoie le nombre de surveillants notifiés.
--    Grâce au garde-fou « déjà prévenu aujourd'hui », un second appel
--    le même jour renverra 0 : c'est normal.
-- ---------------------------------------------------------------------
-- SELECT public.notifier_reclamations_a_verifier();


-- ---------------------------------------------------------------------
-- 6. Voir ce qui a été envoyé.
-- ---------------------------------------------------------------------
-- SELECT p.full_name, n.title, n.message, n.created_at
-- FROM public.notifications n
-- JOIN public.profiles p ON p.user_id = n.user_id
-- WHERE n.title = 'Réclamations à vérifier'
-- ORDER BY n.created_at DESC
-- LIMIT 20;


-- ---------------------------------------------------------------------
-- 7. Historique des exécutions du planificateur (diagnostic).
-- ---------------------------------------------------------------------
-- SELECT j.jobname, d.status, d.return_message, d.start_time
-- FROM cron.job_run_details d
-- JOIN cron.job j ON j.jobid = d.jobid
-- WHERE j.jobname = 'rappel_reclamations_22h30'
-- ORDER BY d.start_time DESC
-- LIMIT 10;


-- ---------------------------------------------------------------------
-- Pour arrêter les rappels :
--   SELECT cron.unschedule('rappel_reclamations_22h30');
-- ---------------------------------------------------------------------
