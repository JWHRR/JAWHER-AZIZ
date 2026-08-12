import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useAuth } from '@/contexts/AuthContext';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Menu } from 'lucide-react';
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
    setMobileSidebarOpen(false);
  }, [selectConversation, markRead]);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  const sidebarProps = {
    conversations,
    activeConversation,
    onSelectConversation: handleSelectConversation,
    onNewChat: () => { setNewChatOpen(true); setMobileSidebarOpen(false); },
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
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        <ChatSidebar {...sidebarProps} />
      </div>

      {/* Mobile floating button + Sheet */}
      <div className="md:hidden">
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed bottom-20 left-4 z-50 h-12 w-12 rounded-full shadow-xl border bg-background"
            >
              <div className="relative">
                <Menu className="h-5 w-5" />
                {totalUnread > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 text-[9px] flex items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-background">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </Badge>
                )}
              </div>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[300px] sm:w-[340px]">
            <ChatSidebar {...sidebarProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Chat area */}
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
      />

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
