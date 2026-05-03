-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- If null, targeted by role
  role public.app_role, -- Target specific role like 'ADMIN'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select"
ON public.notifications FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) OR 
  (role IS NOT NULL AND public.has_role(auth.uid(), role)) OR
  (public.has_role(auth.uid(), 'ADMIN'))
);

CREATE POLICY "notifications_update"
ON public.notifications FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid()) OR 
  (role IS NOT NULL AND public.has_role(auth.uid(), role)) OR
  (public.has_role(auth.uid(), 'ADMIN'))
);

CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true); -- Anyone authenticated can insert a notification (e.g. surveillant reporting a problem)

CREATE POLICY "notifications_delete"
ON public.notifications FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- Update reclamations table
ALTER TABLE public.reclamations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Autre';
