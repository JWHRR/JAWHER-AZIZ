-- Update select policy for reclamations to allow all authenticated users (including SURVEILLANT) to view all reclamations
DROP POLICY IF EXISTS "reclam_select" ON public.reclamations;

CREATE POLICY "reclam_select"
ON public.reclamations FOR SELECT
TO authenticated
USING (true);
