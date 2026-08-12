-- RPC: returns all surveillants (bypasses RLS so any authenticated user can
-- populate the replacement picker, regardless of their own role).
CREATE OR REPLACE FUNCTION public.get_surveillants()
RETURNS TABLE(user_id UUID, full_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM   public.profiles   p
  JOIN   public.user_roles ur ON ur.user_id = p.user_id
  WHERE  ur.role = 'SURVEILLANT'
  ORDER  BY p.full_name;
$$;
