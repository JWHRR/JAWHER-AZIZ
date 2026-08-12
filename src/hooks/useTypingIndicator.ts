import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingUser {
  user_id: string;
  full_name: string;
}

export const useTypingIndicator = (conversationId: string | null, userId: string | null, userName: string) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: userId } },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ full_name: string; is_typing: boolean }>();
        const typingNow: TypingUser[] = [];
        for (const [uid, presences] of Object.entries(state)) {
          const presence = presences[0];
          if (uid !== userId && presence?.is_typing) {
            typingNow.push({ user_id: uid, full_name: presence.full_name });
          }
        }
        setTypingUsers(typingNow);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ is_typing: false, full_name: userName });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId, userName]);

  const sendTyping = useCallback(async () => {
    if (!channelRef.current) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      await channelRef.current.track({ is_typing: true, full_name: userName });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(async () => {
      isTypingRef.current = false;
      if (channelRef.current) {
        await channelRef.current.track({ is_typing: false, full_name: userName });
      }
    }, 2000);
  }, [userName]);

  const label = typingUsers.length === 0
    ? null
    : typingUsers.length === 1
    ? `${typingUsers[0].full_name} est en train d'écrire...`
    : `${typingUsers.map(u => u.full_name).join(', ')} écrivent...`;

  return { typingUsers, typingLabel: label, sendTyping };
};
