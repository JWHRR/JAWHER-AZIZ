-- Create etudiants table
CREATE TABLE IF NOT EXISTS public.etudiants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chambre_id uuid NOT NULL REFERENCES public.chambres(id) ON DELETE CASCADE,
  nom_complet text NOT NULL,
  telephone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Drop old etudiants column from chambres
ALTER TABLE public.chambres DROP COLUMN IF EXISTS etudiants;

-- Enable RLS
ALTER TABLE public.etudiants ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE TRIGGER trg_etudiants_updated_at
  BEFORE UPDATE ON public.etudiants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
-- Admin can do everything
CREATE POLICY "etudiants_admin_all" ON public.etudiants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Everyone authenticated can view etudiants
CREATE POLICY "etudiants_select_surv" ON public.etudiants
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "etudiants_insert_surv" ON public.etudiants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN') OR
    EXISTS (
      SELECT 1 FROM public.chambres c
      JOIN public.dortoir_assignments da ON da.dortoir_id = c.dortoir_id
      WHERE c.id = chambre_id AND da.surveillant_id = auth.uid()
    )
  );

CREATE POLICY "etudiants_update_surv" ON public.etudiants
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN') OR
    EXISTS (
      SELECT 1 FROM public.chambres c
      JOIN public.dortoir_assignments da ON da.dortoir_id = c.dortoir_id
      WHERE c.id = chambre_id AND da.surveillant_id = auth.uid()
    )
  );

CREATE POLICY "etudiants_delete_surv" ON public.etudiants
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN') OR
    EXISTS (
      SELECT 1 FROM public.chambres c
      JOIN public.dortoir_assignments da ON da.dortoir_id = c.dortoir_id
      WHERE c.id = chambre_id AND da.surveillant_id = auth.uid()
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_etudiants_chambre ON public.etudiants(chambre_id);
