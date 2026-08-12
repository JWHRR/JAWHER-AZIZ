-- =========================================================
-- WEEKEND PERMANENCES
-- =========================================================
CREATE TABLE public.weekend_permanences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Représente le Lundi de la semaine
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_start_date)
);

ALTER TABLE public.weekend_permanences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_weekend_perms_updated_at
BEFORE UPDATE ON public.weekend_permanences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "weekend_perms_select"
ON public.weekend_permanences FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "weekend_perms_admin_all"
ON public.weekend_permanences FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
