-- Allow surveillants to manage chambres in their assigned dortoirs

CREATE POLICY "chambres_insert_surv" ON public.chambres
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN') OR
    dortoir_id IN (SELECT dortoir_id FROM public.dortoir_assignments WHERE surveillant_id = auth.uid())
  );

CREATE POLICY "chambres_update_surv" ON public.chambres
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN') OR
    dortoir_id IN (SELECT dortoir_id FROM public.dortoir_assignments WHERE surveillant_id = auth.uid())
  );

CREATE POLICY "chambres_delete_surv" ON public.chambres
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN') OR
    dortoir_id IN (SELECT dortoir_id FROM public.dortoir_assignments WHERE surveillant_id = auth.uid())
  );
