-- RESPONSABLE_RESTAURANT: read-only access to the restaurant figures.
--
-- Reading is already allowed: restaurant_logs, weekend_effectifs and dortoirs
-- all expose `FOR SELECT TO authenticated USING (true)`.
--
-- What was missing is the other half: the write policies said
-- "surveillant_id = auth.uid()", which let ANY authenticated account insert or
-- update a row on its own behalf. We now require the caller to actually be a
-- SURVEILLANT (or ADMIN), so the new role can look but never touch.

-- ── Lecture ─────────────────────────────────────────────────────────────────
-- Forcé ici aussi : selon que la migration 20260426 a été appliquée ou non, la
-- base peut encore porter la version restrictive de database_setup.sql, qui
-- limite la lecture à l'ADMIN et au surveillant propriétaire de la ligne — le
-- Responsable Restaurant ne verrait alors aucun pointage.
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

-- ── restaurant_logs ─────────────────────────────────────────────────────────
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

-- ── weekend_effectifs ───────────────────────────────────────────────────────
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

-- DELETE on both tables is already ADMIN-only, nothing to change there.
