-- =========================================================
-- PERMANENCE LOGS (Pointage)
-- =========================================================
CREATE TABLE public.permanence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  observation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security: Enable RLS
ALTER TABLE public.permanence_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "permlogs_select" ON public.permanence_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN') 
    OR surveillant_id = auth.uid()
  );

CREATE POLICY "permlogs_insert" ON public.permanence_logs
  FOR INSERT TO authenticated
  WITH CHECK (surveillant_id = auth.uid());

CREATE POLICY "permlogs_update" ON public.permanence_logs
  FOR UPDATE TO authenticated
  USING (surveillant_id = auth.uid());

CREATE POLICY "permlogs_delete" ON public.permanence_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Trigger for updated_at
CREATE TRIGGER trg_permlogs_updated_at
BEFORE UPDATE ON public.permanence_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful indexes
CREATE INDEX idx_permlogs_date ON public.permanence_logs(date);
CREATE INDEX idx_permlogs_surv ON public.permanence_logs(surveillant_id);
