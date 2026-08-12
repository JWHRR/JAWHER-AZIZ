-- =========================================================
-- CHAT SYSTEM — Fresh setup (drop + recreate everything)
-- =========================================================

-- Drop everything in reverse dependency order
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP FUNCTION IF EXISTS public.create_private_conversation(UUID);
DROP FUNCTION IF EXISTS public.create_group_conversation(TEXT, UUID[]);
DROP FUNCTION IF EXISTS public.update_conversation_last_message();
DROP FUNCTION IF EXISTS public.current_user_is_member(UUID);
DROP TYPE IF EXISTS public.conversation_type CASCADE;
DROP TYPE IF EXISTS public.member_role CASCADE;

-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.conversation_type AS ENUM ('private', 'group', 'channel');
CREATE TYPE public.member_role AS ENUM ('member', 'admin');

-- =========================================================
-- TABLES
-- =========================================================
CREATE TABLE public.conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            public.conversation_type NOT NULL DEFAULT 'private',
    name            TEXT,
    description     TEXT,
    avatar_url      TEXT,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.conversation_members (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            public.member_role NOT NULL DEFAULT 'member',
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    content         TEXT,
    image_url       TEXT,
    reply_to_id     UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    is_edited       BOOLEAN NOT NULL DEFAULT false,
    is_pinned       BOOLEAN NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.message_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TRIGGER: update last_message_at on new message
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.conversations
    SET last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_update_conv
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- =========================================================
-- HELPER: membership check (SECURITY DEFINER avoids RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.current_user_is_member(conv_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = conv_id AND user_id = auth.uid()
    );
$$;

-- =========================================================
-- RPC: create_private_conversation
-- Creates conversation + adds both members atomically.
-- SECURITY DEFINER bypasses RLS so the insert+select never fails.
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_private_conversation(other_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_conv_id UUID;
BEGIN
    -- Return existing private conversation if one already exists
    SELECT cm1.conversation_id INTO v_conv_id
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    JOIN public.conversations c ON c.id = cm1.conversation_id
    WHERE cm1.user_id = v_user_id
      AND cm2.user_id = other_user_id
      AND c.type = 'private'
    LIMIT 1;

    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    INSERT INTO public.conversations (type, created_by)
    VALUES ('private', v_user_id)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role) VALUES
        (v_conv_id, v_user_id,      'admin'),
        (v_conv_id, other_user_id,  'member');

    RETURN v_conv_id;
END;
$$;

-- =========================================================
-- RPC: create_group_conversation
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_group_conversation(group_name TEXT, member_ids UUID[])
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_conv_id UUID;
    v_member  UUID;
BEGIN
    INSERT INTO public.conversations (type, name, created_by)
    VALUES ('group', group_name, v_user_id)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES (v_conv_id, v_user_id, 'admin');

    FOREACH v_member IN ARRAY member_ids LOOP
        IF v_member <> v_user_id THEN
            INSERT INTO public.conversation_members (conversation_id, user_id, role)
            VALUES (v_conv_id, v_member, 'member')
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN v_conv_id;
END;
$$;

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- conversations — visible only to participants, never to admins by default
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
USING (
    type = 'channel' OR
    created_by = auth.uid() OR
    public.current_user_is_member(id)
);

CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE TO authenticated
USING (
    public.current_user_is_member(id) AND
    EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid() AND role = 'admin')
    OR public.has_role(auth.uid(), 'ADMIN')
);

-- conversation_members
CREATE POLICY "members_select" ON public.conversation_members FOR SELECT TO authenticated
USING (
    public.current_user_is_member(conversation_id) OR
    EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND type = 'channel')
);

CREATE POLICY "members_insert" ON public.conversation_members FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'ADMIN') OR
    EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND created_by = auth.uid())
);

CREATE POLICY "members_update" ON public.conversation_members FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "members_delete" ON public.conversation_members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

-- messages
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND type = 'channel') OR
    public.current_user_is_member(conversation_id)
);

CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND (
        EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND type = 'channel') OR
        public.current_user_is_member(conversation_id)
    )
);

CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid());

CREATE POLICY "messages_delete" ON public.messages FOR DELETE TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

-- message_reactions
CREATE POLICY "reactions_select" ON public.message_reactions FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_id AND public.current_user_is_member(m.conversation_id)
    )
);

CREATE POLICY "reactions_insert" ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON public.message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- =========================================================
-- STORAGE
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_uploads', 'chat_uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "chat_auth_upload"  ON storage.objects;
DROP POLICY IF EXISTS "chat_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "chat_auth_delete"  ON storage.objects;

CREATE POLICY "chat_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'chat_uploads');
CREATE POLICY "chat_auth_upload"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_uploads' AND auth.role() = 'authenticated');
CREATE POLICY "chat_auth_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'chat_uploads' AND auth.uid() = owner);
CREATE POLICY "chat_auth_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'chat_uploads' AND auth.uid() = owner);

-- =========================================================
-- RPC: delete_conversation
-- Creator/admin → deletes entire conversation (CASCADE removes all).
-- Regular member → just removes themselves (leave).
-- =========================================================
CREATE OR REPLACE FUNCTION public.delete_conversation(conv_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id   UUID := auth.uid();
    v_is_member BOOLEAN;
    v_is_creator BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_id = conv_id AND user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN RETURN; END IF;

    SELECT (created_by = v_user_id)
    INTO v_is_creator
    FROM public.conversations
    WHERE id = conv_id;

    IF v_is_creator THEN
        DELETE FROM public.conversations WHERE id = conv_id;
    ELSE
        DELETE FROM public.conversation_members
        WHERE conversation_id = conv_id AND user_id = v_user_id;
    END IF;
END;
$$;

-- =========================================================
-- REALTIME
-- =========================================================
-- =========================================================
-- PROFILES: SECURITY DEFINER helpers for messaging
-- These bypass RLS so every role (SURVEILLANT, TECHNICIEN, ADMIN)
-- can look up profiles when using the chat feature.
-- =========================================================

-- Returns all active profiles (for the new-conversation user list)
CREATE OR REPLACE FUNCTION public.get_chat_profiles()
RETURNS TABLE(user_id UUID, full_name TEXT, email TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT user_id, full_name, email
  FROM public.profiles
  WHERE is_active = true
  ORDER BY full_name;
$$;

-- Returns profile names for a given set of user IDs (for message sender display)
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(p_ids UUID[])
RETURNS TABLE(user_id UUID, full_name TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT user_id, full_name
  FROM public.profiles
  WHERE user_id = ANY(p_ids);
$$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
