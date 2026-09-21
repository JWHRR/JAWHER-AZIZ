-- =====================================================================
-- Vérifications — à lancer APRÈS fix_acces_responsable_restaurant.sql
--
-- Ce fichier ne modifie rien. Exécutez chaque requête SÉPARÉMENT
-- (sélectionnez le bloc, puis Run) : la requête 3 ouvre une transaction
-- qu'elle annule à la fin.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Quelles règles de lecture sont en place ?
--    Attendu : condition = true sur les trois tables.
-- ---------------------------------------------------------------------
SELECT tablename, policyname, qual AS condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('restaurant_logs', 'weekend_effectifs', 'dortoirs')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------
-- 2. Le compte de Marwen est-il correct ?
--    Attendu : role = RESPONSABLE_RESTAURANT
-- ---------------------------------------------------------------------
SELECT u.email, p.full_name, r.role
FROM auth.users u
LEFT JOIN public.profiles   p ON p.user_id = u.id
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE u.email = 'marwen@ipest.com';


-- ---------------------------------------------------------------------
-- 3. Vérification RÉELLE : on se place sous l'identité de Marwen et on
--    relit les pointages avec SES règles RLS.
--    Attendu : les pointages de la semaine. Si c'est vide, la lecture
--    est encore bloquée.
--
--    Sélectionnez de BEGIN; jusqu'à ROLLBACK; et exécutez d'un bloc.
--    Le ROLLBACK n'annule que cette transaction de test.
-- ---------------------------------------------------------------------
BEGIN;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  (SELECT id FROM auth.users WHERE email = 'marwen@ipest.com'),
      'role', 'authenticated'
    )::text,
    true
  );
  SET LOCAL ROLE authenticated;

  SELECT date, repas, nombre_eleves
  FROM public.restaurant_logs
  WHERE date >= date_trunc('week', current_date)::date
  ORDER BY date, repas;
ROLLBACK;


-- ---------------------------------------------------------------------
-- 4. Les pointages existent-ils vraiment ?
--    (exécuté en administrateur, donc sans filtrage RLS)
-- ---------------------------------------------------------------------
SELECT l.date, l.repas, l.nombre_eleves, p.full_name AS saisi_par
FROM public.restaurant_logs l
LEFT JOIN public.profiles p ON p.user_id = l.surveillant_id
WHERE l.date >= current_date - 7
ORDER BY l.date DESC, l.repas;


-- ---------------------------------------------------------------------
-- 5. Affectations de Nour.
--    Le planning récurrent est stocké par JOUR DE LA SEMAINE
--    (LUN, MAR, …), le planning ponctuel par date.
--    weekday est un enum et date une date : les deux sont convertis en
--    texte, sinon l'UNION refuse de les rapprocher.
-- ---------------------------------------------------------------------
SELECT p.full_name,
       'récurrent'        AS type,
       t.weekday::text    AS jour,
       t.repas::text      AS repas
FROM public.restaurant_template t
JOIN public.profiles p ON p.user_id = t.surveillant_id
WHERE p.full_name ILIKE '%nour%'

UNION ALL

SELECT p.full_name,
       'ponctuel'         AS type,
       a.date::text       AS jour,
       a.repas::text      AS repas
FROM public.restaurant_assignments a
JOIN public.profiles p ON p.user_id = a.surveillant_id
WHERE p.full_name ILIKE '%nour%'

ORDER BY 2, 3;  -- positions : l'ORDER BY d'une UNION est plus sûr en ordinal


-- ---------------------------------------------------------------------
-- 6. Quel jour de la semaine sommes-nous, côté base ?
--    À comparer avec le jour affiché par l'application.
-- ---------------------------------------------------------------------
SELECT (now() AT TIME ZONE 'Africa/Tunis')::date          AS date_tunis,
       to_char(now() AT TIME ZONE 'Africa/Tunis', 'Day')  AS jour_tunis,
       CASE EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Africa/Tunis'))
            WHEN 1 THEN 'LUN' WHEN 2 THEN 'MAR' WHEN 3 THEN 'MER'
            WHEN 4 THEN 'JEU' WHEN 5 THEN 'VEN' WHEN 6 THEN 'SAM'
            ELSE 'DIM'
       END AS code_attendu_par_l_application;
