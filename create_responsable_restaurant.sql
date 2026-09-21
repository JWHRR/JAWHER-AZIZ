-- =====================================================================
-- Rôle "Responsable Restaurant" + compte marwen@ipest.com
-- À exécuter dans le SQL Editor de Supabase.
--
-- IMPORTANT : exécutez les ÉTAPES 1 et 2 SÉPARÉMENT (une exécution
-- chacune). PostgreSQL refuse d'utiliser une nouvelle valeur d'enum dans
-- la même transaction que celle qui l'a ajoutée.
-- =====================================================================


-- =====================================================================
-- ÉTAPE 1 — Ajouter le rôle à l'enum. Sélectionnez UNIQUEMENT cette
--            ligne et exécutez-la, puis passez à l'étape 2.
-- =====================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'RESPONSABLE_RESTAURANT';


-- =====================================================================
-- ÉTAPE 2 — Créer le compte et lui donner le rôle.
--            (à exécuter dans une seconde exécution)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path TO public, extensions;

DO $$
DECLARE
    v_email    text := 'marwen@ipest.com';
    v_password text := '@marwen@123';
    v_name     text := 'Marwen';
    v_uid      uuid;
BEGIN
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

    IF v_uid IS NULL THEN
        v_uid := gen_random_uuid();

        -- Le trigger on_auth_user_created remplit public.profiles et pose le
        -- rôle SURVEILLANT par défaut ; on le corrige juste après.
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at,
            confirmation_token, recovery_token, email_change_token_new, email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
            v_email, crypt(v_password, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', v_name),
            now(), now(), '', '', '', ''
        );

        RAISE NOTICE 'Compte créé : % (%)', v_email, v_uid;
    ELSE
        -- Le compte existe déjà : on remet le mot de passe demandé.
        UPDATE auth.users
        SET encrypted_password = crypt(v_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            banned_until       = NULL,
            updated_at         = now()
        WHERE id = v_uid;

        RAISE NOTICE 'Compte existant mis à jour : % (%)', v_email, v_uid;
    END IF;

    -- Identité e-mail : requise par GoTrue pour la connexion par mot de passe.
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    )
    SELECT gen_random_uuid(), v_uid,
           jsonb_build_object('sub', v_uid::text, 'email', v_email),
           'email', v_uid::text, now(), now(), now()
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.identities
        WHERE user_id = v_uid AND provider = 'email'
    );

    -- Profil (filet de sécurité si le trigger n'existe pas).
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (v_uid, v_name, v_email)
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- Rôle unique : RESPONSABLE_RESTAURANT.
    DELETE FROM public.user_roles WHERE user_id = v_uid;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'RESPONSABLE_RESTAURANT');
END $$;


-- =====================================================================
-- ÉTAPE 3 — Vérification. Attendu : role = RESPONSABLE_RESTAURANT
--                                    et password_ok = true
-- =====================================================================
SELECT u.email,
       p.full_name,
       r.role,
       (u.encrypted_password = crypt('@marwen@123', u.encrypted_password)) AS password_ok,
       (u.email_confirmed_at IS NOT NULL) AS email_confirme,
       EXISTS (SELECT 1 FROM auth.identities i
               WHERE i.user_id = u.id AND i.provider = 'email') AS identite_ok
FROM auth.users u
LEFT JOIN public.profiles   p ON p.user_id = u.id
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE u.email = 'marwen@ipest.com';
