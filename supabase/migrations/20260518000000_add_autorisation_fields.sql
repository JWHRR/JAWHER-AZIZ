-- Alter etudiants table to add authorization fields
ALTER TABLE public.etudiants ADD COLUMN IF NOT EXISTS autorisation_absence BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.etudiants ADD COLUMN IF NOT EXISTS autorisation_voiture BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.etudiants ADD COLUMN IF NOT EXISTS matricule_voiture TEXT DEFAULT '';
