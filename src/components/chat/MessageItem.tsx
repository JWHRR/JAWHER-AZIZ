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
  'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500',
];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

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

  // Facebook Messenger exact bubble rounding logic
  const bubbleRadius = isOwn
    ? cn(
        'rounded-[18px]',
        isFirst && !isLast && 'rounded-br-[4px]',
        !isFirst && !isLast && 'rounded-tr-[4px] rounded-br-[4px]',
        !isFirst && isLast && 'rounded-tr-[4px]'
      )
    : cn(
        'rounded-[18px]',
        isFirst && !isLast && 'rounded-bl-[4px]',
        !isFirst && !isLast && 'rounded-tl-[4px] rounded-bl-[4px]',
        !isFirst && isLast && 'rounded-tl-[4px]'
      );

  const isActionsVisible = hovered || showReactionPicker;

  const actionsNode = (
    <div
      className={cn(
        'items-center gap-0.5 transition-all duration-150',
        isActionsVisible
          ? 'flex opacity-100'
          : 'hidden sm:flex sm:opacity-0 sm:pointer-events-none'
      )}
    >
      {onReact && (
        <button
          type="button"
          className="h-7 w-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setShowReactionPicker((v) => !v);
          }}
          title="Réagir"
        >
          <SmilePlus className="h-4 w-4" />
        </button>
      )}
      {isOwn && onDelete && (
        <button
          type="button"
          className="h-7 w-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(message.id);
          }}
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'flex w-full gap-2 relative group',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        isFirst ? 'mt-2.5' : 'mt-0.5'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setShowReactionPicker(false);
      }}
      onClick={() => setHovered((v) => !v)}
    >
      {/* Avatar — only on other messages on the LAST message of the group */}
      {!isOwn && (
        <div className="shrink-0 w-7 self-end mb-0.5">
          {isLast ? (
            <Avatar className={cn('h-7 w-7', colorClass)}>
              <AvatarFallback className={cn('text-white text-[11px] font-semibold', colorClass)}>
                {getInitials(senderName)}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      )}

      {/* Content Column */}
      <div
        className={cn(
          'flex flex-col max-w-[85%] sm:max-w-[480px]',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {/* Sender name for group chats */}
        {!isOwn && isFirst && (
          <span className="text-[11px] font-medium text-gray-500 mb-0.5 ml-3">
            {senderName}
          </span>
        )}

        {/* Bubble Row with floating actions */}
        <div className="flex items-center gap-1.5 relative">
          {isOwn && actionsNode}

          {/* Messenger Bubble */}
          <div
            className={cn(
              'relative px-3.5 py-2 text-[15px] sm:text-sm leading-relaxed transition-colors',
              bubbleRadius,
              isOwn
                ? 'bg-[#0084FF] text-white shadow-xs'
                : 'bg-[#F0F2F5] text-[#050505]'
            )}
          >
            {message.image_url && (
              <img
                src={message.image_url}
                alt="Image partagée"
                className="max-w-[220px] sm:max-w-xs rounded-xl mb-1 object-cover cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(message.image_url!, '_blank');
                }}
              />
            )}
            {message.content && (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>

          {!isOwn && actionsNode}
        </div>

        {/* Attached Reaction Badge */}
        {onReact && (
          <MessageReactionBar
            messageId={message.id}
            reactions={reactions}
            onReact={(id, emoji) => {
              onReact(id, emoji);
              setShowReactionPicker(false);
            }}
            visible={showReactionPicker}
            isOwn={isOwn}
          />
        )}

        {/* Timestamp on hover or on last */}
        {isLast && (
          <span
            className={cn(
              'text-[10px] text-gray-400 mt-0.5 px-1 transition-opacity duration-150',
              isActionsVisible ? 'opacity-100' : 'opacity-0'
            )}
          >
            {format(new Date(message.created_at), 'HH:mm')}
            {message.is_edited && ' · modifié'}
          </span>
        )}
      </div>
    </div>
  );
};
