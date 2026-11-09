import React, { useState } from 'react';
import { Conversation } from '@/hooks/useChat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, SquarePen } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (conv: Conversation) => void;
  onNewChat: () => void;
  loading?: boolean;
  currentUserId: string;
  onlineUsers: Set<string>;
  unreadMap?: Record<string, number>;
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Hier';
  return format(date, 'dd/MM', { locale: fr });
};

const getInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500',
];
const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewChat,
  loading,
  currentUserId,
  onlineUsers,
  unreadMap = {},
}) => {
  const [search, setSearch] = useState('');

  const getConvName = (conv: Conversation) => {
    if (conv.type === 'private') {
      return conv.members?.find((m) => m.user_id !== currentUserId)?.full_name ?? 'Message privé';
    }
    return conv.name ?? 'Groupe';
  };

  const getOtherUserId = (conv: Conversation) =>
    conv.type === 'private' ? conv.members?.find((m) => m.user_id !== currentUserId)?.user_id : undefined;

  const filtered = conversations.filter((c) =>
    getConvName(c).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#242526] h-full select-none">
      {/* Messenger Sidebar Header */}
      <div className="px-4 pt-4 pb-2.5 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#050505] dark:text-white">
            Discussions
          </h1>
          <button
            type="button"
            onClick={onNewChat}
            className="h-9 w-9 rounded-full bg-[#F0F2F5] dark:bg-gray-800 hover:bg-[#E4E6EB] dark:hover:bg-gray-700 flex items-center justify-center transition-colors text-[#050505] dark:text-gray-200"
            title="Nouveau message"
          >
            <SquarePen className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Messenger Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8A8D91]" />
          <Input
            placeholder="Rechercher dans Messenger"
            className="pl-9 h-9 bg-[#F0F2F5] dark:bg-[#3A3B3C] border-none rounded-full text-sm focus-visible:ring-0 placeholder:text-[#8A8D91] text-[#050505] dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Messenger Conversations List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-3 space-y-0.5">
          {loading
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-28 rounded-full" />
                    <Skeleton className="h-3 w-40 rounded-full" />
                  </div>
                </div>
              ))
            : filtered.map((conv) => {
                const isActive = activeConversation?.id === conv.id;
                const name = getConvName(conv);
                const otherUserId = getOtherUserId(conv);
                const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
                const unread = unreadMap[conv.id] ?? 0;
                const hasUnread = unread > 0 && !isActive;
                const colorClass = avatarColor(conv.id);

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv)}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors relative',
                      isActive
                        ? 'bg-[#EBF5FF] dark:bg-[#2D3F55]'
                        : 'hover:bg-[#F2F2F2] dark:hover:bg-gray-800/60'
                    )}
                  >
                    {/* Avatar with Online Presence Dot */}
                    <div className="relative shrink-0">
                      <Avatar className={cn('h-12 w-12', colorClass)}>
                        <AvatarFallback className={cn('text-white font-semibold text-sm', colorClass)}>
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      {conv.type === 'private' && isOnline && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#31A24C] border-2 border-white dark:border-[#242526]" />
                      )}
                    </div>

                    {/* Text block */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex justify-between items-baseline gap-2">
                        <span
                          className={cn(
                            'text-[15px] truncate leading-snug',
                            hasUnread
                              ? 'font-bold text-[#050505] dark:text-white'
                              : 'font-semibold text-gray-800 dark:text-gray-200'
                          )}
                        >
                          {name}
                        </span>
                        <span
                          className={cn(
                            'text-[11px] shrink-0',
                            hasUnread ? 'text-[#0084FF] font-bold' : 'text-[#8A8D91]'
                          )}
                        >
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <p
                          className={cn(
                            'text-[13px] truncate leading-tight',
                            hasUnread
                              ? 'text-[#050505] dark:text-white font-bold'
                              : 'text-[#65676B] dark:text-gray-400'
                          )}
                        >
                          {hasUnread
                            ? `${unread} nouveau${unread > 1 ? 'x' : ''} message${unread > 1 ? 's' : ''}`
                            : 'Appuyez pour ouvrir'}
                        </p>

                        {/* Unread dot / badge */}
                        {hasUnread && (
                          <span className="h-3 w-3 rounded-full bg-[#0084FF] shrink-0 ml-1.5" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-[#8A8D91]">Aucune discussion trouvée</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
