-- Update select policy for weekend_effectifs to allow all authenticated users to view all weekend effectifs
DROP POLICY IF EXISTS "weekend_select" ON public.weekend_effectifs;

CREATE POLICY "weekend_select"
ON public.weekend_effectifs FOR SELECT
TO authenticated
USING (true);
