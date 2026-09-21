-- =====================================================================
-- Reset the ADMIN account password to 'chokri123'
-- Run this in the Supabase SQL Editor (it runs as a superuser there,
-- which is required to write to the auth schema).
-- =====================================================================

-- pgcrypto provides crypt() / gen_salt(), used by GoTrue to hash passwords.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Resolve crypt() whether pgcrypto lives in "extensions" (Supabase default)
-- or in "public".
SET search_path TO public, extensions;


-- ---------------------------------------------------------------------
-- STEP 1 - Check which account(s) you are about to change.
-- Run this on its own first and confirm the e-mail is the right one.
-- ---------------------------------------------------------------------
SELECT u.id, u.email, p.full_name, r.role
FROM auth.users u
LEFT JOIN public.profiles   p ON p.user_id = u.id
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.role = 'ADMIN';


-- ---------------------------------------------------------------------
-- STEP 2 - Set the password to 'chokri123' for every ADMIN user.
-- ---------------------------------------------------------------------
UPDATE auth.users
SET encrypted_password = crypt('chokri123', gen_salt('bf')),
    updated_at         = now(),
    -- make sure the account can actually log in
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until       = NULL,
    -- invalidate any pending reset / change flow
    recovery_token     = '',
    recovery_sent_at   = NULL
WHERE id IN (
    SELECT user_id FROM public.user_roles WHERE role = 'ADMIN'
);


-- ---------------------------------------------------------------------
-- STEP 3 - Force existing sessions to re-authenticate (optional).
-- ---------------------------------------------------------------------
DELETE FROM auth.sessions
WHERE user_id IN (
    SELECT user_id FROM public.user_roles WHERE role = 'ADMIN'
);


-- ---------------------------------------------------------------------
-- STEP 4 - Verify. Expected: password_ok = true
-- ---------------------------------------------------------------------
SELECT u.email,
       (u.encrypted_password = crypt('chokri123', u.encrypted_password)) AS password_ok
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id
WHERE r.role = 'ADMIN';


-- =====================================================================
-- ALTERNATIVE - target one specific account by e-mail instead of by role.
-- Replace the address, then run just this block.
-- =====================================================================
-- UPDATE auth.users
-- SET encrypted_password = crypt('chokri123', gen_salt('bf')),
--     updated_at         = now(),
--     email_confirmed_at = COALESCE(email_confirmed_at, now()),
--     banned_until       = NULL,
--     recovery_token     = '',
--     recovery_sent_at   = NULL
-- WHERE email = 'chokri@gmail.com';
