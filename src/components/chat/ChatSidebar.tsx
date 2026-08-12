import React, { useState } from 'react';
import { Conversation } from '@/hooks/useChat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Edit } from 'lucide-react';
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
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
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
      return conv.members?.find(m => m.user_id !== currentUserId)?.full_name ?? 'Message privé';
    }
    return conv.name ?? 'Groupe';
  };

  const getOtherUserId = (conv: Conversation) =>
    conv.type === 'private' ? conv.members?.find(m => m.user_id !== currentUserId)?.user_id : undefined;

  const filtered = conversations.filter(c =>
    getConvName(c).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-[300px] xl:w-[320px] shrink-0 flex flex-col bg-white h-full border-r border-gray-100">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
          <button
            onClick={onNewChat}
            className="h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            title="Nouvelle conversation"
          >
            <Edit className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher dans Messenger"
            className="pl-9 h-9 bg-gray-100 border-none rounded-full text-sm focus-visible:ring-0 placeholder:text-gray-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
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
            : filtered.map(conv => {
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
                    onClick={() => onSelectConversation(conv)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors',
                      isActive ? 'bg-blue-50' : 'hover:bg-gray-100'
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <Avatar className={cn('h-12 w-12', colorClass)}>
                        <AvatarFallback className={cn('text-white font-semibold text-sm', colorClass)}>
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      {conv.type === 'private' && isOnline && (
                        <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className={cn(
                          'text-sm truncate',
                          hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                        )}>
                          {name}
                        </span>
                        <span className={cn(
                          'text-[11px] ml-2 shrink-0',
                          hasUnread ? 'text-blue-600 font-semibold' : 'text-gray-400'
                        )}>
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={cn(
                          'text-xs truncate',
                          hasUnread ? 'text-gray-800 font-semibold' : 'text-gray-400'
                        )}>
                          {hasUnread ? `${unread} nouveau${unread > 1 ? 'x' : ''} message${unread > 1 ? 's' : ''}` : 'Appuyez pour ouvrir'}
                        </p>
                        {hasUnread && (
                          <span className="h-5 min-w-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 ml-1">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-gray-400">Aucune conversation trouvée</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
