import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadCountsContextValue {
  unreadMap: Record<string, number>;
  totalUnread: number;
  markRead: (conversationId: string) => Promise<void>;
  markUnread: (conversationId: string) => Promise<void>;
  fetchUnread: () => Promise<void>;
}

const UnreadCountsContext = createContext<UnreadCountsContextValue | null>(null);

export const UnreadCountsProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const fetchUnread = useCallback(async () => {
    if (!userId) {
      setUnreadMap({});
      return;
    }

    try {
      const { data: memberships, error } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (error || !memberships) return;

      const counts: Record<string, number> = {};

      await Promise.all(
        memberships.map(async (m) => {
          let q = supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', m.conversation_id)
            .is('deleted_at', null)
            .neq('sender_id', userId);

          if (m.last_read_at) {
            q = q.gt('created_at', m.last_read_at);
          }

          const { count } = await q;
          counts[m.conversation_id] = count ?? 0;
        })
      );

      setUnreadMap(counts);
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchUnread();

    if (!userId) return;

    let channel: any = null;
    try {
      const channelName = `unread_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          fetchUnread();
        });

      channel.subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel error for unread counts');
        }
      });
    } catch (err) {
      console.warn('Failed to subscribe to unread messages channel:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [userId, fetchUnread]);

  const markRead = useCallback(async (conversationId: string) => {
    if (!userId) return;
    try {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      setUnreadMap((prev) => ({ ...prev, [conversationId]: 0 }));
    } catch (err) {
      console.error('Error in markRead:', err);
    }
  }, [userId]);

  const markUnread = useCallback(async (conversationId: string) => {
    if (!userId) return;
    try {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastMsg) return;

      const justBefore = new Date(new Date(lastMsg.created_at).getTime() - 1).toISOString();
      await supabase
        .from('conversation_members')
        .update({ last_read_at: justBefore })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      await fetchUnread();
    } catch (err) {
      console.error('Error in markUnread:', err);
    }
  }, [userId, fetchUnread]);

  const totalUnread = Object.values(unreadMap).reduce((sum, count) => sum + count, 0);

  return (
    <UnreadCountsContext.Provider value={{ unreadMap, totalUnread, markRead, markUnread, fetchUnread }}>
      {children}
    </UnreadCountsContext.Provider>
  );
};

export const useUnreadCounts = (_userId?: string | null) => {
  const ctx = useContext(UnreadCountsContext);
  if (ctx) {
    return ctx;
  }

  // Graceful fallback if called outside provider
  return {
    unreadMap: {},
    totalUnread: 0,
    markRead: async () => {},
    markUnread: async () => {},
    fetchUnread: async () => {},
  };
};
