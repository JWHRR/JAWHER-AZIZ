import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a map of conversationId -> unread count
 * based on how many messages were created after the user's last_read_at
 */
export const useUnreadCounts = (userId: string | null) => {
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const fetchUnread = useCallback(async () => {
    if (!userId) return;

    // Get all conversations the user is a member of with their last_read_at
    const { data: memberships, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (error || !memberships) return;

    const counts: Record<string, number> = {};

    await Promise.all(
      memberships.map(async (m) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', m.conversation_id)
          .is('deleted_at', null)
          .neq('sender_id', userId)
          .gt('created_at', m.last_read_at);

        counts[m.conversation_id] = count ?? 0;
      })
    );

    setUnreadMap(counts);
  }, [userId]);

  useEffect(() => {
    fetchUnread();

    // Re-fetch when a new message arrives
    const channel = supabase
      .channel('unread:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchUnread]);

  const markRead = useCallback(async (conversationId: string) => {
    if (!userId) return;
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    setUnreadMap(prev => ({ ...prev, [conversationId]: 0 }));
  }, [userId]);

  const markUnread = useCallback(async (conversationId: string) => {
    if (!userId) return;
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
  }, [userId, fetchUnread]);

  return { unreadMap, markRead, markUnread };
};
