-- Update RLS policies for restaurant tables to allow better coordination among surveillants

-- 1. Restaurant Assignments
DROP POLICY IF EXISTS "restassign_select" ON public.restaurant_assignments;
CREATE POLICY "restassign_select"
ON public.restaurant_assignments FOR SELECT
TO authenticated
USING (true); -- Allow all authenticated users to see assignments

-- 2. Restaurant Logs
DROP POLICY IF EXISTS "restlogs_select" ON public.restaurant_logs;
CREATE POLICY "restlogs_select"
ON public.restaurant_logs FOR SELECT
TO authenticated
USING (true); -- Allow all authenticated users to see logs

-- 3. Restaurant Template (already has public select, but let's be sure)
DROP POLICY IF EXISTS "resttmpl_select_auth" ON public.restaurant_template;
CREATE POLICY "resttmpl_select_auth" ON public.restaurant_template
  FOR SELECT TO authenticated USING (true);
