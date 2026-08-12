import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Reaction = {
  emoji: string;
  count: number;
  byCurrentUser: boolean;
  users: string[];
};

export type MessageReactions = Record<string, Reaction>;

export const useMessageReactions = (userId: string | null) => {
  const [reactionsMap, setReactionsMap] = useState<Record<string, MessageReactions>>({});

  const loadReactions = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length) return;

    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds);

    if (error || !data) return;

    const map: Record<string, MessageReactions> = {};

    for (const row of data) {
      if (!map[row.message_id]) map[row.message_id] = {};
      const msgReactions = map[row.message_id];
      if (!msgReactions[row.emoji]) {
        msgReactions[row.emoji] = { emoji: row.emoji, count: 0, byCurrentUser: false, users: [] };
      }
      msgReactions[row.emoji].count += 1;
      msgReactions[row.emoji].users.push(row.user_id);
      if (row.user_id === userId) {
        msgReactions[row.emoji].byCurrentUser = true;
      }
    }

    setReactionsMap(map);
  }, [userId]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;

    const existing = reactionsMap[messageId]?.[emoji];
    const alreadyReacted = existing?.byCurrentUser;

    // Optimistic update
    setReactionsMap(prev => {
      const msgReactions = { ...(prev[messageId] ?? {}) };
      if (alreadyReacted) {
        if (msgReactions[emoji]) {
          const newCount = msgReactions[emoji].count - 1;
          if (newCount <= 0) {
            const { [emoji]: _, ...rest } = msgReactions;
            return { ...prev, [messageId]: rest };
          }
          msgReactions[emoji] = {
            ...msgReactions[emoji],
            count: newCount,
            byCurrentUser: false,
            users: msgReactions[emoji].users.filter(u => u !== userId),
          };
        }
      } else {
        msgReactions[emoji] = {
          emoji,
          count: (msgReactions[emoji]?.count ?? 0) + 1,
          byCurrentUser: true,
          users: [...(msgReactions[emoji]?.users ?? []), userId],
        };
      }
      return { ...prev, [messageId]: msgReactions };
    });

    // DB operation
    if (alreadyReacted) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);
    } else {
      await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: userId, emoji });
    }
  }, [userId, reactionsMap]);

  return { reactionsMap, loadReactions, toggleReaction };
};
