import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type MessageSender = {
  full_name: string;
  avatar_url?: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sender?: MessageSender;
};

export type ConversationMember = {
  user_id: string;
  full_name?: string;
};

export type Conversation = {
  id: string;
  type: 'private' | 'group' | 'channel';
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_at: string;
  members?: ConversationMember[];
};

const buildProfileMap = async (userIds: string[]): Promise<Record<string, string>> => {
  if (userIds.length === 0) return {};
  const { data } = await supabase.rpc('get_profiles_by_ids', { p_ids: userIds });
  const map: Record<string, string> = {};
  (data ?? []).forEach((p: any) => { map[p.user_id] = p.full_name; });
  return map;
};

export const useChat = () => {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const activeConvRef = useRef<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setLoadingConversations(true);

    const { data, error } = await supabase
      .from('conversations')
      .select('id, type, name, description, avatar_url, created_by, last_message_at, conversation_members(user_id)')
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('fetchConversations error:', error);
      setLoadingConversations(false);
      return;
    }

    const allUserIds = [...new Set(
      (data ?? []).flatMap((c: any) => (c.conversation_members ?? []).map((m: any) => m.user_id))
    )];

    const profileMap = await buildProfileMap(allUserIds);

    const enriched = (data ?? []).map((c: any) => ({
      ...c,
      members: (c.conversation_members ?? []).map((m: any) => ({
        user_id: m.user_id,
        full_name: profileMap[m.user_id] ?? 'Utilisateur',
      })),
    }));

    setConversations(enriched);
    setLoadingConversations(false);
  }, [userId]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, image_url, reply_to_id, is_edited, is_pinned, created_at, updated_at, deleted_at')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('fetchMessages error:', error);
      toast.error('Impossible de charger les messages');
      setLoadingMessages(false);
      return;
    }

    const senderIds = [...new Set((msgs ?? []).map((m: any) => m.sender_id))];
    const profileMap = await buildProfileMap(senderIds);

    setMessages(
      (msgs ?? []).map((m: any) => ({
        ...m,
        sender: { full_name: profileMap[m.sender_id] ?? 'Utilisateur' },
      }))
    );
    setLoadingMessages(false);
  }, []);

  const selectConversation = useCallback(async (conv: Conversation) => {
    setActiveConversation(conv);
    activeConvRef.current = conv.id;
    await fetchMessages(conv.id);

    if (userId) {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conv.id)
        .eq('user_id', userId);
    }
  }, [fetchMessages, userId]);

  const sendMessage = useCallback(async (
    content: string,
    imageUrl: string | null = null
  ) => {
    if (!activeConvRef.current || !userId) return;
    if (!content.trim() && !imageUrl) return;

    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeConvRef.current,
      sender_id: userId,
      content,
      image_url: imageUrl,
      reply_to_id: null,
      is_edited: false,
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      sender: { full_name: profile?.full_name ?? 'Vous' },
    };

    setMessages(prev => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConvRef.current,
        sender_id: userId,
        content: content || null,
        image_url: imageUrl,
      })
      .select('id, conversation_id, sender_id, content, image_url, reply_to_id, is_edited, is_pinned, created_at, updated_at, deleted_at')
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      toast.error("Erreur lors de l'envoi du message");
    } else {
      setMessages(prev =>
        prev.map(m =>
          m.id === optimistic.id
            ? { ...(data as any), sender: { full_name: profile?.full_name ?? 'Vous' } }
            : m
        )
      );
    }
  }, [userId, profile]);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('chat_uploads')
      .upload(path, file, { upsert: false });

    if (error) {
      toast.error("Erreur lors de l'upload du fichier");
      return null;
    }

    const { data } = supabase.storage.from('chat_uploads').getPublicUrl(path);
    return data.publicUrl;
  }, [userId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', userId!);

    if (error) {
      toast.error("Impossible de supprimer le message");
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  }, [userId]);

  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    const { error } = await supabase.rpc('delete_conversation', { conv_id: conversationId });
    if (error) {
      toast.error("Impossible de supprimer la conversation");
      console.error(error);
      return false;
    }
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (activeConvRef.current === conversationId) {
      activeConvRef.current = null;
      setActiveConversation(null);
      setMessages([]);
    }
    return true;
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchConversations();

    const channel = supabase
      .channel('chat:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.conversation_id === activeConvRef.current && newMsg.sender_id !== userId) {
            const profileMap = await buildProfileMap([newMsg.sender_id]);
            setMessages(prev => [...prev, { ...newMsg, sender: { full_name: profileMap[newMsg.sender_id] ?? 'Utilisateur' } }]);
          }
          fetchConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchConversations]);

  return {
    conversations,
    activeConversation,
    messages,
    loadingConversations,
    loadingMessages,
    selectConversation,
    sendMessage,
    uploadFile,
    deleteMessage,
    deleteConversation,
    fetchConversations,
    setActiveConversation,
  };
};
