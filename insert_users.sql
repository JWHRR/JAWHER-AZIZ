DO $$ 
DECLARE
    uid_chokri uuid := gen_random_uuid();
    uid_walid uuid := gen_random_uuid();
    uid_ahmed uuid := gen_random_uuid();
    uid_ala uuid := gen_random_uuid();
    uid_harathi uuid := gen_random_uuid();
    uid_yousef uuid := gen_random_uuid();
    uid_raslen uuid := gen_random_uuid();
    uid_ela uuid := gen_random_uuid();
    uid_maryem uuid := gen_random_uuid();
    uid_tasnim uuid := gen_random_uuid();
    uid_wiem uuid := gen_random_uuid();
    uid_chiraz uuid := gen_random_uuid();
BEGIN

-- 1. Insert all users into Supabase Auth safely
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES 
('00000000-0000-0000-0000-000000000000', uid_chokri, 'authenticated', 'authenticated', 'chokri@gmail.com', crypt('@chokri@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Chokri Jrebi"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_walid, 'authenticated', 'authenticated', 'walid@ipest.com', crypt('@walid@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Walid"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_ahmed, 'authenticated', 'authenticated', 'ahmed@ipest.com', crypt('@mnasri@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mnasri ahmed"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_ala, 'authenticated', 'authenticated', 'ala@ipest.com', crypt('@mahfoudhi@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ala mahfoudhi"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_harathi, 'authenticated', 'authenticated', 'harathi@ipest.com', crypt('@harathi@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aberrahim Harrathi"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_yousef, 'authenticated', 'authenticated', 'yousef@ipest.com', crypt('@ammar@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Yousef Ammar"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_raslen, 'authenticated', 'authenticated', 'raslen@ipest.com', crypt('@benamor@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Raslen Ben amor"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_ela, 'authenticated', 'authenticated', 'ela@ipest.com', crypt('@uoledhamed@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ela ouledhamed"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_maryem, 'authenticated', 'authenticated', 'maryem@ipest.com', crypt('@benrejeb@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Maryem ben rejeb"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_tasnim, 'authenticated', 'authenticated', 'tasnim@ipest.com', crypt('@hmida@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tasnim Hmida"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_wiem, 'authenticated', 'authenticated', 'wiem@ipest.com', crypt('@chuiref@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Wiem Chuiref"}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', uid_chiraz, 'authenticated', 'authenticated', 'chiraz@ipest.com', crypt('@hajji@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Chiraz hajji"}', now(), now(), '', '', '', '');

-- Note: The trigger we wrote earlier will automatically catch these inserts 
-- and create matching records in `public.profiles` and `public.user_roles` 
-- as 'SURVEILLANT' by default.

-- 2. Update specific roles to ADMIN and TECHNICIEN
UPDATE public.user_roles SET role = 'ADMIN' WHERE user_id = uid_chokri;
UPDATE public.user_roles SET role = 'TECHNICIEN' WHERE user_id = uid_walid;

END $$;
