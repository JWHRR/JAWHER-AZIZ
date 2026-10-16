-- =====================================================================
-- Migration: Suivi de crédibilité du Responsable Réparation (Technicien)
-- =====================================================================

-- 1. Ajouter les colonnes de suivi de réparation par le technicien
ALTER TABLE public.reclamations
  ADD COLUMN IF NOT EXISTS tech_done BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tech_done_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tech_done_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reclamations_tech_done ON public.reclamations(tech_done);

-- 2. Mettre à jour les politiques RLS pour autoriser le technicien à modifier ces champs
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
