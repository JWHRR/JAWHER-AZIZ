-- =========================================================
-- TABLE D'ENREGISTREMENT DES ABSENCES CONSÉCUTIVES (3+ NUITS)
-- Permet de conserver l'historique complet et permanent
-- =========================================================

CREATE TABLE IF NOT EXISTS public.absences_consecutives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id UUID REFERENCES public.etudiants(id) ON DELETE CASCADE,
  nom_complet TEXT NOT NULL,
  dortoir_id UUID REFERENCES public.dortoirs(id) ON DELETE CASCADE,
  dortoir_code TEXT,
  chambre_numero TEXT,
  telephone TEXT,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  nombre_nuits INTEGER NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_cours', -- 'en_cours' ou 'terminee'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(etudiant_id, date_debut, date_fin)
);

ALTER TABLE public.absences_consecutives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "absences_consecutives_select"
ON public.absences_consecutives FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "absences_consecutives_insert"
ON public.absences_consecutives FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "absences_consecutives_update"
ON public.absences_consecutives FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "absences_consecutives_delete"
ON public.absences_consecutives FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE INDEX IF NOT EXISTS idx_absences_consecutives_etudiant
ON public.absences_consecutives(etudiant_id);

CREATE INDEX IF NOT EXISTS idx_absences_consecutives_dates
ON public.absences_consecutives(date_debut, date_fin);
