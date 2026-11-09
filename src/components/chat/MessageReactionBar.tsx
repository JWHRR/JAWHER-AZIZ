import React from 'react';
import { MessageReactions } from '@/hooks/useMessageReactions';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface MessageReactionBarProps {
  messageId: string;
  reactions: MessageReactions;
  onReact: (messageId: string, emoji: string) => void;
  visible: boolean;
  isOwn: boolean;
}

export const MessageReactionBar: React.FC<MessageReactionBarProps> = ({
  messageId,
  reactions,
  onReact,
  visible,
  isOwn,
}) => {
  const existingEmojis = Object.values(reactions);
  const totalReactionCount = existingEmojis.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className={cn('relative', isOwn ? 'flex flex-col items-end' : 'flex flex-col items-start')}>
      {/* Floating Messenger Quick reaction bar (above bubble) */}
      {visible && (
        <div
          className={cn(
            'absolute -top-11 z-30 flex items-center gap-1 bg-white border border-gray-200/90 shadow-xl rounded-full px-2 py-1',
            'animate-in fade-in zoom-in-95 duration-150',
            isOwn ? 'right-0' : 'left-0'
          )}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                onReact(messageId, emoji);
              }}
              className={cn(
                'text-lg leading-none p-1.5 rounded-full hover:scale-135 hover:bg-gray-100 transition-transform duration-150 active:scale-95 origin-bottom',
                reactions[emoji]?.byCurrentUser && 'bg-blue-50 scale-110'
              )}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Messenger style overlapping reaction badge */}
      {existingEmojis.length > 0 && (
        <div
          className={cn(
            'flex items-center -mt-2.5 z-10 select-none',
            isOwn ? 'mr-2 self-end' : 'ml-2 self-start'
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(messageId, existingEmojis[0].emoji);
                }}
                className={cn(
                  'flex items-center gap-0.5 bg-white border border-gray-200 shadow-xs rounded-full px-1.5 py-0.5 text-[11px] hover:scale-105 active:scale-95 transition-transform',
                  existingEmojis.some((r) => r.byCurrentUser) &&
                    'border-blue-400 bg-blue-50/80 text-[#0084FF]'
                )}
              >
                {existingEmojis.slice(0, 3).map((r) => (
                  <span key={r.emoji} className="text-xs leading-none">
                    {r.emoji}
                  </span>
                ))}
                {totalReactionCount > 1 && (
                  <span className="text-[10px] font-bold text-gray-700 ml-0.5">
                    {totalReactionCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs bg-gray-900 text-white">
              {existingEmojis.map((r) => `${r.emoji} ${r.count}`).join(' · ')}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
