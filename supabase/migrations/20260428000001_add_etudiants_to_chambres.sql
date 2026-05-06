-- Add etudiants column to chambres
ALTER TABLE public.chambres ADD COLUMN IF NOT EXISTS etudiants TEXT;
