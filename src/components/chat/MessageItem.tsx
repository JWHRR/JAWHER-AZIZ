import React, { useState } from 'react';
import { Message } from '@/hooks/useChat';
import { MessageReactions } from '@/hooks/useMessageReactions';
import { MessageReactionBar } from './MessageReactionBar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Trash2, SmilePlus } from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  isFirst: boolean;
  isLast: boolean;
  onDelete?: (id: string) => void;
  reactions?: MessageReactions;
  onReact?: (messageId: string, emoji: string) => void;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  isFirst,
  isLast,
  onDelete,
  reactions = {},
  onReact,
}) => {
  const [hovered, setHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const senderName = message.sender?.full_name ?? 'Utilisateur';
  const colorClass = avatarColor(message.sender_id);

  // Messenger-style bubble radius
  const bubbleRadius = isOwn
    ? cn(
        'rounded-[18px]',
        isFirst && !isLast && 'rounded-tr-[4px]',
        !isFirst && !isLast && 'rounded-tr-[4px] rounded-br-[4px]',
        !isFirst && isLast && 'rounded-br-[4px]',
      )
    : cn(
        'rounded-[18px]',
        isFirst && !isLast && 'rounded-tl-[4px]',
        !isFirst && !isLast && 'rounded-tl-[4px] rounded-bl-[4px]',
        !isFirst && isLast && 'rounded-bl-[4px]',
      );

  return (
    <div
      className={cn(
        'flex w-full gap-2',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        isFirst ? 'mt-3' : 'mt-0.5'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowReactionPicker(false); }}
    >
      {/* Avatar — only for others, only on last message in group */}
      <div className="shrink-0 w-8 self-end mb-0.5">
        {!isOwn && isLast ? (
          <Avatar className={cn('h-8 w-8', colorClass)}>
            <AvatarFallback className={cn('text-white text-xs font-semibold', colorClass)}>
              {getInitials(senderName)}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      {/* Content column */}
      <div className={cn('flex flex-col max-w-[70%] sm:max-w-[420px]', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name for groups — only on first message */}
        {!isOwn && isFirst && (
          <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-1">
            {senderName}
          </span>
        )}

        {/* Bubble row */}
        <div className={cn('flex items-center gap-1.5', isOwn ? 'flex-row-reverse' : 'flex-row')}>

          {/* Hover actions */}
          <div className={cn(
            'flex items-center gap-0.5 transition-opacity duration-100',
            hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}>
            {onReact && (
              <button
                className="h-7 w-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowReactionPicker(v => !v)}
                title="Réagir"
              >
                <SmilePlus className="h-4 w-4" />
              </button>
            )}
            {isOwn && onDelete && (
              <button
                className="h-7 w-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                onClick={() => onDelete(message.id)}
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Bubble */}
          <div className={cn(
            'relative px-3 py-2 text-sm',
            bubbleRadius,
            isOwn
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-900'
          )}>
            {message.image_url && (
              <img
                src={message.image_url}
                alt="Image"
                className="max-w-[220px] sm:max-w-xs rounded-xl mb-1.5 object-cover cursor-zoom-in"
                onClick={() => window.open(message.image_url!, '_blank')}
              />
            )}
            {message.content && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            )}
          </div>
        </div>

        {/* Timestamp — only on last in group, visible on hover */}
        {isLast && (
          <span className={cn(
            'text-[10px] text-gray-400 mt-1 px-1 transition-opacity duration-100',
            hovered ? 'opacity-100' : 'opacity-0'
          )}>
            {format(new Date(message.created_at), 'HH:mm')}
            {message.is_edited && ' · modifié'}
          </span>
        )}

        {/* Reactions */}
        {onReact && (
          <div className="mt-0.5">
            <MessageReactionBar
              messageId={message.id}
              reactions={reactions}
              onReact={onReact}
              visible={showReactionPicker}
              isOwn={isOwn}
            />
          </div>
        )}
      </div>
    </div>
  );
};
