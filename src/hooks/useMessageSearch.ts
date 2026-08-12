import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from './useChat';

export const useMessageSearch = (conversationId: string | null) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim() || !conversationId) {
      setResults([]);
      return;
    }

    setSearching(true);
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id, conversation_id, sender_id, content, image_url,
        reply_to_id, is_edited, is_pinned, created_at, updated_at, deleted_at,
        sender:profiles!messages_sender_id_fkey(full_name)
      `)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error) setResults((data as any) ?? []);
    setSearching(false);
  }, [conversationId]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return { query, results, searching, search, clear };
};
