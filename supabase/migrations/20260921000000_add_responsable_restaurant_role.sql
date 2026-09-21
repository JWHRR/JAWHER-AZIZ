-- Add the RESPONSABLE_RESTAURANT role.
--
-- This MUST stay alone in its own migration: PostgreSQL refuses to use a new
-- enum value inside the same transaction that added it ("unsafe use of new
-- value of enum type"). The policies that reference it live in the next
-- migration.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'RESPONSABLE_RESTAURANT';
