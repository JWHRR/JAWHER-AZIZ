-- 1. Add is_active to profiles for soft-delete
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Day-of-week enum (1=Monday ... 7=Sunday, ISO)
DO $$ BEGIN
  CREATE TYPE public.weekday AS ENUM ('LUN','MAR','MER','JEU','VEN','SAM','DIM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Permanence weekly template (recurring)
CREATE TABLE IF NOT EXISTS public.permanence_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillant_id uuid NOT NULL,
  weekday public.weekday NOT NULL,
  slot public.permanence_slot NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (weekday, slot, surveillant_id)
);
ALTER TABLE public.permanence_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permtmpl_select_auth" ON public.permanence_template
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "permtmpl_admin_all" ON public.permanence_template
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER trg_permtmpl_updated
  BEFORE UPDATE ON public.permanence_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Restaurant weekly template (recurring)
CREATE TABLE IF NOT EXISTS public.restaurant_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillant_id uuid NOT NULL,
  weekday public.weekday NOT NULL,
  repas public.repas_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (weekday, repas, surveillant_id)
);
ALTER TABLE public.restaurant_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resttmpl_select_auth" ON public.restaurant_template
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "resttmpl_admin_all" ON public.restaurant_template
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER trg_resttmpl_updated
  BEFORE UPDATE ON public.restaurant_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Chambres (rooms inside dortoirs)
CREATE TABLE IF NOT EXISTS public.chambres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dortoir_id uuid NOT NULL REFERENCES public.dortoirs(id) ON DELETE CASCADE,
  numero text NOT NULL,
  capacite integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dortoir_id, numero)
);
ALTER TABLE public.chambres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chambres_select_auth" ON public.chambres
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "chambres_admin_all" ON public.chambres
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- 6. Chambre inspections (daily room check by surveillant)
CREATE TABLE IF NOT EXISTS public.chambre_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chambre_id uuid NOT NULL REFERENCES public.chambres(id) ON DELETE CASCADE,
  surveillant_id uuid NOT NULL,
  date date NOT NULL,
  proprete integer NOT NULL DEFAULT 5 CHECK (proprete BETWEEN 1 AND 5),
  ordre integer NOT NULL DEFAULT 5 CHECK (ordre BETWEEN 1 AND 5),
  degats boolean NOT NULL DEFAULT false,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chambre_id, date)
);
ALTER TABLE public.chambre_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chambinsp_select" ON public.chambre_inspections
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR surveillant_id = auth.uid());

CREATE POLICY "chambinsp_insert_self_or_admin" ON public.chambre_inspections
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN') OR surveillant_id = auth.uid());

CREATE POLICY "chambinsp_update_self_or_admin" ON public.chambre_inspections
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR surveillant_id = auth.uid());

CREATE POLICY "chambinsp_delete_admin" ON public.chambre_inspections
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER trg_chambinsp_updated
  BEFORE UPDATE ON public.chambre_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_chambinsp_date ON public.chambre_inspections(date);
CREATE INDEX IF NOT EXISTS idx_chambinsp_surv ON public.chambre_inspections(surveillant_id);
CREATE INDEX IF NOT EXISTS idx_chambres_dortoir ON public.chambres(dortoir_id);