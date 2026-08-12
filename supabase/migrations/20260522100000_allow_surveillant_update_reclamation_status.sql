-- Allow surveillants to update reclamation status (same as admin/technicien)
DROP POLICY IF EXISTS "reclam_update_admin_or_tech" ON public.reclamations;

CREATE POLICY "reclam_update_admin_tech_surv" ON public.reclamations
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'TECHNICIEN')
    OR public.has_role(auth.uid(), 'SURVEILLANT')
  );
