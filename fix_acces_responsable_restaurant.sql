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
-- Il ne contient QUE des modifications : les vérifications sont dans
-- verif_responsable_restaurant.sql, à exécuter ensuite.
--
-- À exécuter dans le SQL Editor de Supabase, en une seule fois.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Lecture : ouverte à tous les comptes connectés.
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
-- 2. Écriture : réservée aux SURVEILLANT et ADMIN.
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

-- Terminé. Lancez maintenant verif_responsable_restaurant.sql.
