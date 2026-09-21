-- =====================================================================
-- Le Responsable Restaurant ne voit pas les pointages : accès RLS
--
-- La base contient deux définitions concurrentes de "restlogs_select" :
--   * database_setup.sql  -> ADMIN uniquement, ou sa propre ligne
--   * migration 20260426  -> tous les comptes connectés
-- Si la migration n'a jamais été appliquée, le Responsable Restaurant
-- lit zéro ligne et son tableau de bord reste vide.
--
-- Ce script force l'état correct, quel que soit l'état actuel.
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ÉTAPE 1 — Constat : quelles règles de lecture sont réellement en place ?
-- ---------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual AS condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('restaurant_logs', 'weekend_effectifs', 'dortoirs')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------
-- ÉTAPE 2 — Lecture : ouverte à tous les comptes connectés.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "restlogs_select" ON public.restaurant_logs;
CREATE POLICY "restlogs_select"
ON public.restaurant_logs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "weekend_select" ON public.weekend_effectifs;
CREATE POLICY "weekend_select"
ON public.weekend_effectifs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "dortoirs_select_all_auth" ON public.dortoirs;
CREATE POLICY "dortoirs_select_all_auth"
ON public.dortoirs FOR SELECT
TO authenticated
USING (true);

-- Utile aussi pour la page Restaurant des surveillants (affectations).
DROP POLICY IF EXISTS "restassign_select" ON public.restaurant_assignments;
CREATE POLICY "restassign_select"
ON public.restaurant_assignments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "resttmpl_select_auth" ON public.restaurant_template;
CREATE POLICY "resttmpl_select_auth"
ON public.restaurant_template FOR SELECT
TO authenticated
USING (true);


-- ---------------------------------------------------------------------
-- ÉTAPE 3 — Écriture : réservée aux SURVEILLANT et ADMIN.
-- Les anciennes règles se contentaient de "surveillant_id = auth.uid()",
-- ce qui autorisait n'importe quel compte connecté — dont le Responsable
-- Restaurant — à écrire pour lui-même.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "restlogs_insert_self_or_admin" ON public.restaurant_logs;
CREATE POLICY "restlogs_insert_self_or_admin"
ON public.restaurant_logs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ADMIN')
  OR (surveillant_id = auth.uid() AND public.has_role(auth.uid(), 'SURVEILLANT'))
);

DROP POLICY IF EXISTS "restlogs_update_self_or_admin" ON public.restaurant_logs;
CREATE POLICY "restlogs_update_self_or_admin"
ON public.restaurant_logs FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR (surveillant_id = auth.uid() AND public.has_role(auth.uid(), 'SURVEILLANT'))
);

DROP POLICY IF EXISTS "weekend_insert_self_or_admin" ON public.weekend_effectifs;
CREATE POLICY "weekend_insert_self_or_admin"
ON public.weekend_effectifs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ADMIN')
  OR (surveillant_id = auth.uid() AND public.has_role(auth.uid(), 'SURVEILLANT'))
);

DROP POLICY IF EXISTS "weekend_update_self_or_admin" ON public.weekend_effectifs;
CREATE POLICY "weekend_update_self_or_admin"
ON public.weekend_effectifs FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR (surveillant_id = auth.uid() AND public.has_role(auth.uid(), 'SURVEILLANT'))
);


-- ---------------------------------------------------------------------
-- ÉTAPE 4 — Vérification RÉELLE : on se met à la place de Marwen.
-- La requête s'exécute avec son identité et ses règles RLS.
-- Attendu : le nombre de pointages de la semaine, et non 0.
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
-- ÉTAPE 5 — Le pointage existe-t-il vraiment pour aujourd'hui ?
-- (exécuté en tant qu'administrateur, donc sans filtrage RLS)
-- ---------------------------------------------------------------------
SELECT l.date, l.repas, l.nombre_eleves, p.full_name AS saisi_par
FROM public.restaurant_logs l
LEFT JOIN public.profiles p ON p.user_id = l.surveillant_id
WHERE l.date >= current_date - 7
ORDER BY l.date DESC, l.repas;


-- ---------------------------------------------------------------------
-- ÉTAPE 6 — Affectations de Nour (pour le problème d'affectation).
-- Le planning récurrent est stocké par JOUR DE LA SEMAINE.
-- ---------------------------------------------------------------------
SELECT p.full_name, t.weekday, t.repas, 'récurrent' AS type
FROM public.restaurant_template t
JOIN public.profiles p ON p.user_id = t.surveillant_id
WHERE p.full_name ILIKE '%nour%'
UNION ALL
SELECT p.full_name, a.date::text, a.repas, 'ponctuel'
FROM public.restaurant_assignments a
JOIN public.profiles p ON p.user_id = a.surveillant_id
WHERE p.full_name ILIKE '%nour%'
ORDER BY 4, 2;
