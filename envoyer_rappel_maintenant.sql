-- =====================================================================
-- ENVOI IMMÉDIAT du rappel « réclamations à vérifier »
--
-- Envoie tout de suite, sans attendre 22h30, à chaque surveillant actif
-- ayant des réclamations non terminées.
--
-- Autonome : fonctionne même si rappel_reclamations_22h30.sql n'a pas
-- encore été exécuté.
--
-- Le titre est le même que celui du rappel automatique, donc le job de
-- 22h30 verra qu'un rappel est déjà parti aujourd'hui et ne l'enverra
-- pas une seconde fois ce soir.
--
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

DO $envoi$
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
        SELECT count(*),
               COALESCE(max(v_today - (r.created_at AT TIME ZONE 'Africa/Tunis')::date), 0)
        INTO v_count, v_oldest
        FROM public.reclamations r
        WHERE r.created_by = v_surv.user_id
          AND r.status <> 'TERMINEE';

        -- Rien à vérifier : pas de notification inutile.
        CONTINUE WHEN v_count = 0;

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

    RAISE NOTICE 'Rappel envoyé à % surveillant(s).', v_sent;
END
$envoi$;


-- ---------------------------------------------------------------------
-- Qui vient de recevoir le rappel, et quoi exactement ?
-- ---------------------------------------------------------------------
SELECT p.full_name AS surveillant,
       n.message,
       to_char(n.created_at AT TIME ZONE 'Africa/Tunis', 'DD/MM HH24:MI') AS envoye_a
FROM public.notifications n
JOIN public.profiles p ON p.user_id = n.user_id
WHERE n.title = 'Réclamations à vérifier'
  AND (n.created_at AT TIME ZONE 'Africa/Tunis')::date
      = (now() AT TIME ZONE 'Africa/Tunis')::date
ORDER BY p.full_name;


-- ---------------------------------------------------------------------
-- Qui n'a RIEN reçu, et pourquoi ?
-- Attendu : « aucune réclamation en cours » pour les surveillants à jour.
-- ---------------------------------------------------------------------
SELECT p.full_name AS surveillant,
       count(r.id) FILTER (WHERE r.status <> 'TERMINEE') AS reclamations_en_cours,
       CASE WHEN count(r.id) FILTER (WHERE r.status <> 'TERMINEE') = 0
            THEN 'aucune réclamation en cours — rien à rappeler'
            ELSE 'notifié'
       END AS raison
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'SURVEILLANT'
LEFT JOIN public.reclamations r ON r.created_by = p.user_id
WHERE p.is_active = true
GROUP BY p.full_name
ORDER BY p.full_name;
