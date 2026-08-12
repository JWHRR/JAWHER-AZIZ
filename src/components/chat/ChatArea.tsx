import React, { useEffect, useRef, useState } from 'react';
import { Conversation, Message } from '@/hooks/useChat';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { TypingBubble } from './TypingBubble';
import { useAuth } from '@/contexts/AuthContext';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { MessageSquare, MoreVertical, Search, X, Trash2, LogOut, EyeOff } from 'lucide-react';
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
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

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
    const ids = messages.map(m => m.id);
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
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center mb-5">
          <MessageSquare className="h-9 w-9 text-blue-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-1">Vos messages</h3>
        <p className="text-sm text-gray-400 text-center max-w-xs px-6">
          Sélectionnez une conversation ou créez-en une nouvelle.
        </p>
      </div>
    );
  }

  const otherMember = conversation.type === 'private'
    ? conversation.members?.find(m => m.user_id !== userId)
    : null;

  const convName = conversation.type === 'private'
    ? (otherMember?.full_name ?? 'Conversation')
    : (conversation.name ?? 'Groupe');

  const otherUserId = otherMember?.user_id;
  const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
  const memberCount = conversation.members?.length ?? 0;
  const colorClass = avatarColor(conversation.id);

  const displayMessages = showSearch && searchQuery ? searchResults : messages;
  const grouped = groupByDate(displayMessages);

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">

      {/* Header */}
      <div className="h-[60px] shrink-0 px-4 flex items-center justify-between border-b border-gray-100 bg-white">
        {showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <Input
              autoFocus
              placeholder="Rechercher dans la conversation..."
              className="border-none bg-transparent focus-visible:ring-0 text-sm flex-1 h-9 p-0"
              value={searchQuery}
              onChange={e => search(e.target.value)}
            />
            {searching && <span className="text-xs text-gray-400 shrink-0">...</span>}
            {searchQuery && !searching && (
              <span className="text-xs text-gray-400 shrink-0">{searchResults.length} résultat{searchResults.length !== 1 ? 's' : ''}</span>
            )}
            <button
              className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              onClick={() => setShowSearch(false)}
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className={cn('h-10 w-10', colorClass)}>
                  <AvatarFallback className={cn('text-white font-semibold text-sm', colorClass)}>
                    {getInitials(convName)}
                  </AvatarFallback>
                </Avatar>
                {conversation.type === 'private' && isOnline && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm leading-tight">{convName}</p>
                <p className="text-[11px] text-gray-400 leading-tight">
                  {conversation.type === 'private'
                    ? (isOnline ? 'En ligne' : 'Hors ligne')
                    : `${memberCount} membre${memberCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-blue-500"
                onClick={() => setShowSearch(true)}
                title="Rechercher"
              >
                <Search className="h-4.5 w-4.5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-blue-500">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setShowSearch(true)} className="gap-2 cursor-pointer">
                    <Search className="h-4 w-4" />
                    Rechercher
                  </DropdownMenuItem>
                  {onMarkUnread && (
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer"
                      onClick={() => onMarkUnread(conversation.id)}
                    >
                      <EyeOff className="h-4 w-4" />
                      Marquer comme non lu
                    </DropdownMenuItem>
                  )}
                  {onDeleteConversation && conversation.type !== 'private' && conversation.created_by !== currentUserId && (
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-orange-500 focus:text-orange-500"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <LogOut className="h-4 w-4" />
                      Quitter le groupe
                    </DropdownMenuItem>
                  )}
                  {onDeleteConversation && (conversation.type === 'private' || conversation.created_by === currentUserId) && (
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer text-red-500 focus:text-red-500"
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col bg-white">
        {loadingMessages ? (
          <div className="flex flex-col gap-3 mt-auto">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('flex gap-2', i % 2 !== 0 && 'flex-row-reverse')}>
                <Skeleton className="h-8 w-8 rounded-full shrink-0 self-end" />
                <Skeleton className="h-9 rounded-2xl" style={{ width: `${[140, 200, 160, 220, 120][i]}px` }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-auto">
            {displayMessages.length === 0 && (
              <div className="text-center py-16">
                <div className={cn('h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4', colorClass)}>
                  <span className="text-white text-xl font-bold">{getInitials(convName)}</span>
                </div>
                <p className="font-semibold text-gray-800 text-sm">
                  {showSearch && searchQuery ? 'Aucun résultat' : convName}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {showSearch && searchQuery
                    ? `Aucun message ne contient "${searchQuery}"`
                    : 'Commencez la conversation !'}
                </p>
              </div>
            )}

            {grouped.map(group => (
              <div key={group.label}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-[11px] text-gray-400 bg-white px-2">
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
              <div className="pl-10 mt-1">
                <TypingBubble label={typingLabel} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {!showSearch && (
        <div className="shrink-0 border-t border-gray-100 bg-white">
          <MessageInput onSendMessage={onSendMessage} onTyping={sendTyping} draftMessage={draftMessage} />
        </div>
      )}

      {/* Delete / Leave confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conversation.type === 'group' && conversation.created_by !== currentUserId
                ? 'Quitter le groupe ?'
                : conversation.type === 'group'
                ? 'Supprimer le groupe ?'
                : 'Supprimer la conversation ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conversation.type === 'group' && conversation.created_by !== currentUserId
                ? `Vous allez quitter le groupe "${convName}". Vous ne pourrez plus voir les messages.`
                : conversation.type === 'group'
                ? `Le groupe "${convName}" et tous ses messages seront supprimés définitivement.`
                : `Cette conversation avec ${convName} et tous ses messages seront supprimés définitivement.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
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
