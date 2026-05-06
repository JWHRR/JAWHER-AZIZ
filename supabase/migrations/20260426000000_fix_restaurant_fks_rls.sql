-- Fix missing foreign keys and update RLS for restaurant tables

-- 1. Ensure foreign keys exist for restaurant_template
ALTER TABLE public.restaurant_template 
  DROP CONSTRAINT IF EXISTS restaurant_template_surveillant_id_fkey,
  ADD CONSTRAINT restaurant_template_surveillant_id_fkey 
  FOREIGN KEY (surveillant_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Ensure foreign keys exist for restaurant_assignments (just in case)
ALTER TABLE public.restaurant_assignments
  DROP CONSTRAINT IF EXISTS restaurant_assignments_surveillant_id_fkey,
  ADD CONSTRAINT restaurant_assignments_surveillant_id_fkey 
  FOREIGN KEY (surveillant_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Ensure foreign keys exist for restaurant_logs (just in case)
ALTER TABLE public.restaurant_logs
  DROP CONSTRAINT IF EXISTS restaurant_logs_surveillant_id_fkey,
  ADD CONSTRAINT restaurant_logs_surveillant_id_fkey 
  FOREIGN KEY (surveillant_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Update RLS policies for better visibility
DROP POLICY IF EXISTS "restassign_select" ON public.restaurant_assignments;
CREATE POLICY "restassign_select" ON public.restaurant_assignments 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "restlogs_select" ON public.restaurant_logs;
CREATE POLICY "restlogs_select" ON public.restaurant_logs 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "resttmpl_select_auth" ON public.restaurant_template;
CREATE POLICY "resttmpl_select_auth" ON public.restaurant_template 
  FOR SELECT TO authenticated USING (true);
