import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useNewConversation = (currentUserId: string | null) => {

  const createPrivateConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!currentUserId) return null;

    const { data, error } = await supabase.rpc('create_private_conversation', {
      other_user_id: otherUserId,
    });

    if (error || !data) {
      toast.error("Impossible de créer la conversation");
      console.error(error);
      return null;
    }

    return data as string;
  }, [currentUserId]);

  const createGroupConversation = useCallback(async (
    name: string,
    memberIds: string[]
  ): Promise<string | null> => {
    if (!currentUserId) return null;

    const { data, error } = await supabase.rpc('create_group_conversation', {
      group_name: name,
      member_ids: memberIds,
    });

    if (error || !data) {
      toast.error("Impossible de créer le groupe");
      console.error(error);
      return null;
    }

    toast.success(`Groupe "${name}" créé avec succès`);
    return data as string;
  }, [currentUserId]);

  return { createPrivateConversation, createGroupConversation };
};
