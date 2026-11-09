import React, { useEffect, useRef, useState } from 'react';
import { Conversation, Message } from '@/hooks/useChat';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { TypingBubble } from './TypingBubble';
import { useAuth } from '@/contexts/AuthContext';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { MessageSquare, MoreVertical, Search, X, Trash2, LogOut, EyeOff, Menu, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  loadingMessages: boolean;
  onSendMessage: (content: string, file?: File | null) => Promise<void>;
  onDeleteMessage?: (id: string) => void;
  onDeleteConversation?: (id: string) => Promise<boolean>;
  onMarkUnread?: (conversationId: string) => Promise<void>;
  onlineUsers: Set<string>;
  currentUserId: string;
  draftMessage?: string;
  onOpenSidebar?: () => void;
  onNewChat?: () => void;
}

const groupByDate = (msgs: Message[]) => {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = '';
  for (const msg of msgs) {
    const date = new Date(msg.created_at);
    const label = isToday(date)
      ? "Aujourd'hui"
      : isYesterday(date)
      ? 'Hier'
      : format(date, 'EEEE d MMMM', { locale: fr });
    if (label !== currentLabel) {
      groups.push({ label, messages: [msg] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500',
];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  loadingMessages,
  onSendMessage,
  onDeleteMessage,
  onDeleteConversation,
  onMarkUnread,
  onlineUsers,
  currentUserId,
  draftMessage,
  onOpenSidebar,
  onNewChat,
}) => {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { typingLabel, sendTyping } = useTypingIndicator(
    conversation?.id ?? null,
    userId ?? null,
    profile?.full_name ?? "Quelqu'un"
  );

  const { reactionsMap, loadReactions, toggleReaction } = useMessageReactions(userId ?? null);

  const {
    query: searchQuery,
    results: searchResults,
    searching,
    search,
    clear: clearSearch,
  } = useMessageSearch(conversation?.id ?? null);

  useEffect(() => {
    const ids = messages.map((m) => m.id);
    if (ids.length > 0) loadReactions(ids);
  }, [messages, loadReactions]);

  useEffect(() => {
    if (!showSearch) {
      clearSearch();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showSearch, clearSearch]);

  useEffect(() => {
    if (!showSearch) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingLabel, showSearch]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F0F2F5]/40 dark:bg-[#18191A] p-6 text-center select-none">
        <div className="h-20 w-20 bg-blue-50 dark:bg-blue-950/50 rounded-full flex items-center justify-center mb-4 shadow-xs">
          <MessageSquare className="h-10 w-10 text-[#0084FF]" />
        </div>
        <h3 className="text-2xl font-bold text-[#050505] dark:text-white mb-2">Discussions</h3>
        <p className="text-sm text-[#65676B] dark:text-gray-400 max-w-sm mb-6">
          Sélectionnez une discussion ou commencez une nouvelle conversation.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {onOpenSidebar && (
            <Button variant="outline" size="sm" onClick={onOpenSidebar} className="gap-2 md:hidden rounded-full">
              <Menu className="h-4 w-4" /> Voir mes discussions
            </Button>
          )}
          {onNewChat && (
            <Button size="sm" onClick={onNewChat} className="gap-2 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white">
              <Plus className="h-4 w-4" /> Nouveau message
            </Button>
          )}
        </div>
      </div>
    );
  }

  const otherMember =
    conversation.type === 'private'
      ? conversation.members?.find((m) => m.user_id !== userId)
      : null;

  const convName =
    conversation.type === 'private'
      ? (otherMember?.full_name ?? 'Conversation')
      : (conversation.name ?? 'Groupe');

  const otherUserId = otherMember?.user_id;
  const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
  const memberCount = conversation.members?.length ?? 0;
  const colorClass = avatarColor(conversation.id);

  const displayMessages = showSearch && searchQuery ? searchResults : messages;
  const grouped = groupByDate(displayMessages);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#242526] overflow-hidden relative">
      {/* Messenger Top Navigation Bar */}
      <div className="h-[60px] shrink-0 px-4 flex items-center justify-between border-b border-[#E4E6EB] dark:border-gray-800 bg-white dark:bg-[#242526] sticky top-0 z-30 shadow-xs">
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-[#8A8D91] shrink-0" />
            <Input
              autoFocus
              placeholder="Rechercher dans la discussion..."
              className="border-none bg-transparent focus-visible:ring-0 text-sm flex-1 h-9 p-0"
              value={searchQuery}
              onChange={(e) => search(e.target.value)}
            />
            {searching && <span className="text-xs text-[#8A8D91] shrink-0">...</span>}
            {searchQuery && !searching && (
              <span className="text-xs text-[#8A8D91] shrink-0">
                {searchResults.length} résultat{searchResults.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              type="button"
              className="h-8 w-8 rounded-full hover:bg-[#F0F2F5] dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
              onClick={() => setShowSearch(false)}
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              {onOpenSidebar && (
                <button
                  type="button"
                  onClick={onOpenSidebar}
                  className="md:hidden h-9 w-9 rounded-full hover:bg-[#F0F2F5] dark:hover:bg-gray-800 flex items-center justify-center transition-colors text-gray-700 dark:text-gray-200 -ml-1 shrink-0"
                  title="Retour aux discussions"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className="relative shrink-0">
                <Avatar className={cn('h-10 w-10', colorClass)}>
                  <AvatarFallback className={cn('text-white font-bold text-sm', colorClass)}>
                    {getInitials(convName)}
                  </AvatarFallback>
                </Avatar>
                {conversation.type === 'private' && isOnline && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#31A24C] border-2 border-white dark:border-[#242526]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#050505] dark:text-white text-sm sm:text-[15px] leading-tight truncate">
                  {convName}
                </p>
                <p className="text-[12px] text-[#65676B] dark:text-gray-400 leading-tight truncate mt-0.5">
                  {conversation.type === 'private'
                    ? isOnline
                      ? 'Actif(ve) maintenant'
                      : 'Hors ligne'
                    : `${memberCount} membre${memberCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className="h-9 w-9 rounded-full hover:bg-[#F0F2F5] dark:hover:bg-gray-800 flex items-center justify-center transition-colors text-[#0084FF]"
                onClick={() => setShowSearch(true)}
                title="Rechercher dans la discussion"
              >
                <Search className="h-4.5 w-4.5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full hover:bg-[#F0F2F5] dark:hover:bg-gray-800 flex items-center justify-center transition-colors text-[#0084FF]"
                    title="Options"
                  >
                    <MoreVertical className="h-4.5 w-4.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg">
                  <DropdownMenuItem onClick={() => setShowSearch(true)} className="gap-2.5 cursor-pointer">
                    <Search className="h-4 w-4" />
                    Rechercher
                  </DropdownMenuItem>
                  {onMarkUnread && (
                    <DropdownMenuItem
                      className="gap-2.5 cursor-pointer"
                      onClick={() => onMarkUnread(conversation.id)}
                    >
                      <EyeOff className="h-4 w-4" />
                      Marquer comme non lu
                    </DropdownMenuItem>
                  )}
                  {onDeleteConversation && conversation.type !== 'private' && conversation.created_by !== currentUserId && (
                    <DropdownMenuItem
                      className="gap-2.5 cursor-pointer text-orange-600 focus:text-orange-600"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <LogOut className="h-4 w-4" />
                      Quitter le groupe
                    </DropdownMenuItem>
                  )}
                  {onDeleteConversation && (conversation.type === 'private' || conversation.created_by === currentUserId) && (
                    <DropdownMenuItem
                      className="gap-2.5 cursor-pointer text-red-600 focus:text-red-600"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {conversation.type === 'group' ? 'Supprimer le groupe' : 'Supprimer la conversation'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 flex flex-col bg-white dark:bg-[#242526] w-full">
        {loadingMessages ? (
          <div className="flex flex-col gap-3 mt-auto w-full">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('flex gap-2', i % 2 !== 0 && 'flex-row-reverse')}>
                <Skeleton className="h-7 w-7 rounded-full shrink-0 self-end" />
                <Skeleton className="h-9 rounded-[18px]" style={{ width: `${[140, 200, 160, 220, 120][i]}px` }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-auto w-full">
            {/* Messenger Conversation Initial Profile Banner */}
            {displayMessages.length === 0 && (
              <div className="text-center py-12 flex flex-col items-center select-none">
                <Avatar className={cn('h-20 w-20 mb-3 shadow-sm', colorClass)}>
                  <AvatarFallback className={cn('text-white font-extrabold text-2xl', colorClass)}>
                    {getInitials(convName)}
                  </AvatarFallback>
                </Avatar>
                <h4 className="font-bold text-[#050505] dark:text-white text-lg">
                  {showSearch && searchQuery ? 'Aucun résultat' : convName}
                </h4>
                <p className="text-xs text-[#65676B] dark:text-gray-400 mt-1 max-w-xs">
                  {showSearch && searchQuery
                    ? `Aucun message ne contient "${searchQuery}"`
                    : conversation.type === 'private'
                    ? 'Vous êtes connecté(e) sur Messenger. Envoyez un message ou appuyez sur 👍 pour dire bonjour !'
                    : 'Bienvenue dans le groupe ! Envoyez le premier message.'}
                </p>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.label} className="w-full">
                <div className="flex items-center justify-center my-3">
                  <span className="text-[11px] font-semibold text-[#8A8D91] px-2 uppercase tracking-wide">
                    {group.label}
                  </span>
                </div>
                {group.messages.map((msg, idx) => {
                  const prev = idx > 0 ? group.messages[idx - 1] : null;
                  const next = idx < group.messages.length - 1 ? group.messages[idx + 1] : null;
                  const isFirst = !prev || prev.sender_id !== msg.sender_id;
                  const isLast = !next || next.sender_id !== msg.sender_id;
                  return (
                    <MessageItem
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === userId}
                      isFirst={isFirst}
                      isLast={isLast}
                      onDelete={onDeleteMessage}
                      reactions={reactionsMap[msg.id] ?? {}}
                      onReact={toggleReaction}
                    />
                  );
                })}
              </div>
            ))}

            {!showSearch && (
              <div className="pl-9 mt-1">
                <TypingBubble label={typingLabel} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Messenger Input Bottom Bar */}
      {!showSearch && (
        <div className="shrink-0 border-t border-[#E4E6EB] dark:border-gray-800 bg-white dark:bg-[#242526] sticky bottom-0 z-30">
          <MessageInput
            onSendMessage={onSendMessage}
            onTyping={sendTyping}
            draftMessage={draftMessage}
          />
        </div>
      )}

      {/* Delete / Leave Dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conversation.type === 'group' && conversation.created_by !== currentUserId
                ? 'Quitter le groupe ?'
                : conversation.type === 'group'
                ? 'Supprimer le groupe ?'
                : 'Supprimer la discussion ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conversation.type === 'group' && conversation.created_by !== currentUserId
                ? `Vous allez quitter "${convName}". Vous ne recevrez plus les nouveaux messages.`
                : conversation.type === 'group'
                ? `Le groupe "${convName}" et ses messages seront définitivement supprimés.`
                : `Cette discussion avec ${convName} sera définitivement supprimée.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white rounded-full"
              onClick={async () => {
                setConfirmDelete(false);
                await onDeleteConversation?.(conversation.id);
              }}
            >
              {conversation.type === 'group' && conversation.created_by !== currentUserId
                ? 'Quitter'
                : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
