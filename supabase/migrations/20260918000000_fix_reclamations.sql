-- =========================================================
-- RÉCLAMATIONS — correctif consolidé (idempotent)
-- Regroupe et corrige les policies + colonnes manquantes.
-- Peut être rejoué sans risque.
-- =========================================================

-- --- Colonnes manquantes -------------------------------------------------
ALTER TABLE public.reclamations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Autre';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- Les anciennes lignes créées avant l'ajout de la colonne ont type = NULL
UPDATE public.reclamations SET type = 'Autre' WHERE type IS NULL;

-- --- Index de tri --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reclamations_created_at
  ON public.reclamations(created_at DESC);

-- --- SELECT : tout utilisateur authentifié voit toutes les réclamations ---
-- (un surveillant doit pouvoir suivre les réclamations du foyer, pas
--  uniquement celles qu'il a lui-même créées)
DROP POLICY IF EXISTS "reclam_select" ON public.reclamations;
CREATE POLICY "reclam_select"
ON public.reclamations FOR SELECT
TO authenticated
USING (true);

-- --- INSERT : chacun crée en son nom -------------------------------------
DROP POLICY IF EXISTS "reclam_insert_auth" ON public.reclamations;
CREATE POLICY "reclam_insert_auth"
ON public.reclamations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- --- UPDATE : admin / technicien / surveillant, ou l'auteur --------------
-- WITH CHECK explicite : sans lui, une UPDATE peut passer le USING puis
-- être rejetée silencieusement côté PostgREST (0 ligne retournée).
DROP POLICY IF EXISTS "reclam_update_admin_or_tech" ON public.reclamations;
DROP POLICY IF EXISTS "reclam_update_admin_tech_surv" ON public.reclamations;
CREATE POLICY "reclam_update_admin_tech_surv"
ON public.reclamations FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR public.has_role(auth.uid(), 'TECHNICIEN')
  OR public.has_role(auth.uid(), 'SURVEILLANT')
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'ADMIN')
  OR public.has_role(auth.uid(), 'TECHNICIEN')
  OR public.has_role(auth.uid(), 'SURVEILLANT')
  OR created_by = auth.uid()
);

-- --- DELETE : admin, ou l'auteur de la réclamation -----------------------
DROP POLICY IF EXISTS "reclam_delete_admin" ON public.reclamations;
CREATE POLICY "reclam_delete_admin_or_owner"
ON public.reclamations FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR created_by = auth.uid()
);

-- --- PROFILS : lecture par tout utilisateur authentifié -------------------
-- Sans cela, un surveillant/technicien ne peut lire QUE son propre profil :
-- la colonne « Auteur » des réclamations (et des autres écrans) affiche « — »
-- pour tout le monde sauf soi-même. Il s'agit d'un annuaire interne du
-- personnel ; l'écriture reste limitée à soi-même ou à l'admin.
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
ON public.profiles FOR SELECT
TO authenticated
USING (true);
