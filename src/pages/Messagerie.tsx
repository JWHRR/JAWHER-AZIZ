import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useAuth } from '@/contexts/AuthContext';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { useNewConversation } from '@/hooks/useNewConversation';
import { cn } from '@/lib/utils';

const Messagerie = () => {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;
  const userName = profile?.full_name ?? 'Utilisateur';

  const {
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
  } = useChat();

  const { onlineUsers } = useOnlinePresence(userId, userName);
  const { unreadMap, markRead, markUnread } = useUnreadCounts(userId);

  const location = useLocation();
  const { createPrivateConversation } = useNewConversation(userId);
  const [draftMessage, setDraftMessage] = useState('');
  const pendingRef = useRef<{ userId: string; draft: string } | null>(null);

  const [newChatOpen, setNewChatOpen] = useState(false);

  const handleSendMessage = useCallback(async (content: string, file?: File | null) => {
    let imageUrl: string | null = null;
    if (file) {
      imageUrl = await uploadFile(file);
      if (!imageUrl && !content) return;
    }
    await sendMessage(content, imageUrl);
  }, [sendMessage, uploadFile]);

  const handleConversationCreated = useCallback(async (conversationId: string) => {
    await fetchConversations();
    const { data } = await supabase
      .from('conversations')
      .select('id, type, name, description, avatar_url, created_by, last_message_at, conversation_members(user_id)')
      .eq('id', conversationId)
      .single();
    if (data) {
      const memberIds = (data.conversation_members ?? []).map((m: any) => m.user_id);
      let profileMap: Record<string, string> = {};
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', memberIds);
        (profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
      }
      const enriched = {
        ...data,
        members: (data.conversation_members ?? []).map((m: any) => ({
          user_id: m.user_id,
          full_name: profileMap[m.user_id] ?? 'Utilisateur',
        })),
      };
      selectConversation(enriched as any);
      markRead(conversationId);
    }
  }, [fetchConversations, selectConversation, markRead]);

  useEffect(() => {
    const state = location.state as { openWithUserId?: string; draftMessage?: string } | null;
    if (state?.openWithUserId) {
      pendingRef.current = { userId: state.openWithUserId, draft: state.draftMessage ?? '' };
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingRef.current || loadingConversations) return;
    const { userId: targetId, draft } = pendingRef.current;
    pendingRef.current = null;
    (async () => {
      const convId = await createPrivateConversation(targetId);
      if (convId) {
        await handleConversationCreated(convId);
        setDraftMessage(draft);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingConversations]);

  const handleSelectConversation = useCallback((conv: any) => {
    selectConversation(conv);
    markRead(conv.id);
  }, [selectConversation, markRead]);

  const handleBackToList = useCallback(() => {
    selectConversation(null as any);
  }, [selectConversation]);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  const sidebarProps = {
    conversations,
    activeConversation,
    onSelectConversation: handleSelectConversation,
    onNewChat: () => setNewChatOpen(true),
    loading: loadingConversations,
    currentUserId: userId ?? '',
    onlineUsers,
    unreadMap,
  };

  return (
    <div
      className="flex h-[calc(100vh-4rem)] -mt-6 -mx-6 overflow-hidden bg-background"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Sidebar: visible on desktop, or on mobile when NO conversation is selected */}
      <div
        className={cn(
          "h-full w-full md:w-[320px] xl:w-[340px] shrink-0 border-r border-gray-100 bg-white",
          activeConversation ? "hidden md:flex" : "flex w-full"
        )}
      >
        <ChatSidebar {...sidebarProps} />
      </div>

      {/* Chat area: visible on desktop, or on mobile when a conversation IS selected */}
      <div
        className={cn(
          "h-full flex-1 bg-white overflow-hidden",
          !activeConversation ? "hidden md:flex" : "flex w-full"
        )}
      >
        <ChatArea
          conversation={activeConversation}
          messages={messages}
          loadingMessages={loadingMessages}
          onSendMessage={handleSendMessage}
          onDeleteMessage={deleteMessage}
          onDeleteConversation={deleteConversation}
          onMarkUnread={markUnread}
          onlineUsers={onlineUsers}
          currentUserId={userId ?? ''}
          draftMessage={draftMessage}
          onOpenSidebar={handleBackToList}
          onNewChat={() => setNewChatOpen(true)}
        />
      </div>

      {/* New chat dialog */}
      {userId && (
        <NewChatDialog
          open={newChatOpen}
          onOpenChange={setNewChatOpen}
          currentUserId={userId}
          onConversationCreated={handleConversationCreated}
        />
      )}
    </div>
  );
};

export default Messagerie;
