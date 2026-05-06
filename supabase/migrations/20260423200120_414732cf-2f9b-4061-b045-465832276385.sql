
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'SURVEILLANT', 'TECHNICIEN');
CREATE TYPE public.permanence_slot AS ENUM ('MATIN', 'APRES_MIDI', 'NUIT');
CREATE TYPE public.repas_type AS ENUM ('PETIT_DEJEUNER', 'DEJEUNER', 'DINER');
CREATE TYPE public.reclamation_status AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE');
CREATE TYPE public.reclamation_priority AS ENUM ('BASSE', 'NORMALE', 'HAUTE');

-- =========================================================
-- UTIL: timestamp trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (separate table, never on profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================================
-- DORTOIRS
-- =========================================================
CREATE TABLE public.dortoirs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  capacite INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dortoirs ENABLE ROW LEVEL SECURITY;

INSERT INTO public.dortoirs (code) VALUES
  ('1'), ('2'), ('3'), ('4'), ('5'), ('6'),
  ('7a'), ('7b'), ('8a'), ('8b');

-- =========================================================
-- DORTOIR ASSIGNMENTS (surveillant -> dortoir)
-- =========================================================
CREATE TABLE public.dortoir_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dortoir_id UUID NOT NULL REFERENCES public.dortoirs(id) ON DELETE CASCADE,
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dortoir_id, surveillant_id)
);
ALTER TABLE public.dortoir_assignments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PERMANENCES (calendar shifts)
-- =========================================================
CREATE TABLE public.permanences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot public.permanence_slot NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (surveillant_id, date, slot)
);
ALTER TABLE public.permanences ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_permanences_date ON public.permanences(date);
CREATE INDEX idx_permanences_surv ON public.permanences(surveillant_id);

-- =========================================================
-- RESTAURANT ASSIGNMENTS (admin assigns surveillant to a meal)
-- =========================================================
CREATE TABLE public.restaurant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  repas public.repas_type NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, repas, surveillant_id)
);
ALTER TABLE public.restaurant_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_restassign_date ON public.restaurant_assignments(date);
CREATE INDEX idx_restassign_surv ON public.restaurant_assignments(surveillant_id);

-- =========================================================
-- ABSENCES (daily check per dortoir)
-- =========================================================
CREATE TABLE public.absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dortoir_id UUID NOT NULL REFERENCES public.dortoirs(id) ON DELETE CASCADE,
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  nombre_absents INTEGER NOT NULL DEFAULT 0,
  noms_absents TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dortoir_id, date)
);
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_absences_date ON public.absences(date);

CREATE TRIGGER trg_absences_updated_at
BEFORE UPDATE ON public.absences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RESTAURANT LOGS (pointage)
-- =========================================================
CREATE TABLE public.restaurant_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.restaurant_assignments(id) ON DELETE SET NULL,
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  repas public.repas_type NOT NULL,
  nombre_eleves INTEGER NOT NULL DEFAULT 0,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, repas, surveillant_id)
);
ALTER TABLE public.restaurant_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_restlogs_date ON public.restaurant_logs(date);

CREATE TRIGGER trg_restlogs_updated_at
BEFORE UPDATE ON public.restaurant_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- WEEKEND EFFECTIF (every Thursday)
-- =========================================================
CREATE TABLE public.weekend_effectifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dortoir_id UUID NOT NULL REFERENCES public.dortoirs(id) ON DELETE CASCADE,
  surveillant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semaine_du DATE NOT NULL, -- Thursday date
  nombre_presents INTEGER NOT NULL DEFAULT 0,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dortoir_id, semaine_du)
);
ALTER TABLE public.weekend_effectifs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_weekend_updated_at
BEFORE UPDATE ON public.weekend_effectifs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RECLAMATIONS
-- =========================================================
CREATE TABLE public.reclamations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  lieu TEXT,
  dortoir_id UUID REFERENCES public.dortoirs(id) ON DELETE SET NULL,
  status public.reclamation_status NOT NULL DEFAULT 'EN_ATTENTE',
  priority public.reclamation_priority NOT NULL DEFAULT 'NORMALE',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  notes_technicien TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reclamations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_reclamations_status ON public.reclamations(status);

CREATE TRIGGER trg_reclamations_updated_at
BEFORE UPDATE ON public.reclamations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ACTIVITY LOG
-- =========================================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activity_created ON public.activity_logs(created_at DESC);

-- =========================================================
-- TRIGGER: auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
  );
  -- Default role: SURVEILLANT (admin can change later)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'SURVEILLANT');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
CREATE POLICY "profiles_select_self_or_admin"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "profiles_update_self_or_admin"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "profiles_insert_admin"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'ADMIN'));

-- user_roles : seuls admins gèrent ; chacun peut lire ses rôles
CREATE POLICY "roles_select_self_or_admin"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "roles_admin_all"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- dortoirs : tout authentifié peut lire ; admin gère
CREATE POLICY "dortoirs_select_all_auth"
ON public.dortoirs FOR SELECT TO authenticated USING (true);

CREATE POLICY "dortoirs_admin_all"
ON public.dortoirs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- dortoir_assignments
CREATE POLICY "dortassign_select_auth"
ON public.dortoir_assignments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "dortassign_admin_all"
ON public.dortoir_assignments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- permanences
CREATE POLICY "perm_select"
ON public.permanences FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "perm_admin_all"
ON public.permanences FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- restaurant_assignments
CREATE POLICY "restassign_select"
ON public.restaurant_assignments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "restassign_admin_all"
ON public.restaurant_assignments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- absences : admin tout, surveillant ses propres saisies
CREATE POLICY "absences_select"
ON public.absences FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "absences_insert_self_or_admin"
ON public.absences FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "absences_update_self_or_admin"
ON public.absences FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "absences_delete_admin"
ON public.absences FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- restaurant_logs
CREATE POLICY "restlogs_select"
ON public.restaurant_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "restlogs_insert_self_or_admin"
ON public.restaurant_logs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "restlogs_update_self_or_admin"
ON public.restaurant_logs FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "restlogs_delete_admin"
ON public.restaurant_logs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- weekend_effectifs
CREATE POLICY "weekend_select"
ON public.weekend_effectifs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "weekend_insert_self_or_admin"
ON public.weekend_effectifs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "weekend_update_self_or_admin"
ON public.weekend_effectifs FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR surveillant_id = auth.uid()
);

CREATE POLICY "weekend_delete_admin"
ON public.weekend_effectifs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- reclamations : admin tout ; technicien voit tout et update statut/notes ;
-- créateur voit ses propres ; surveillant peut créer.
CREATE POLICY "reclam_select"
ON public.reclamations FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR public.has_role(auth.uid(), 'TECHNICIEN')
  OR created_by = auth.uid()
);

CREATE POLICY "reclam_insert_auth"
ON public.reclamations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "reclam_update_admin_or_tech"
ON public.reclamations FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR public.has_role(auth.uid(), 'TECHNICIEN')
);

CREATE POLICY "reclam_delete_admin"
ON public.reclamations FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- activity_logs : admin lit tout ; chacun peut insérer ses propres logs
CREATE POLICY "activity_select_admin"
ON public.activity_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "activity_insert_self"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
