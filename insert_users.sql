DO $$ 
DECLARE
    uid_jawher uuid := gen_random_uuid();
    uid_aziz uuid := gen_random_uuid();

BEGIN

-- 1. Insert all users into Supabase Auth safely
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES 
('00000000-0000-0000-0000-000000000000', uid_jawher, 'authenticated', 'authenticated', 'jawher@gmail.com', crypt('jawhersa123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jawher salhi"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_jawher, 'authenticated', 'authenticated', 'aziz@gmail.com', crypt('aziz@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aziz Mahfoudhi"}', now(), now(), '', '', '', ''),

-- Note: The trigger we wrote earlier will automatically catch these inserts 
-- and create matching records in `public.profiles` and `public.user_roles` 
-- as 'SURVEILLANT' by default.

-- 2. Update specific roles to ADMIN and TECHNICIEN
UPDATE public.user_roles SET role = 'ADMIN' WHERE user_id = uid_chokri;
UPDATE public.user_roles SET role = 'TECHNICIEN' WHERE user_id = uid_walid;

END $$;
