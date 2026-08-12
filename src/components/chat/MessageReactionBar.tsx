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

  return (
    <div className={cn(
      'flex flex-col gap-1',
      isOwn ? 'items-end' : 'items-start',
    )}>
      {/* Quick reaction picker — shown on hover */}
      {visible && (
        <div className={cn(
          'flex items-center gap-0.5 bg-background/90 backdrop-blur-md border border-border/60 shadow-lg rounded-full px-2 py-1',
          'animate-in fade-in zoom-in-90 duration-150',
          isOwn ? 'self-end' : 'self-start'
        )}>
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact(messageId, emoji)}
              className={cn(
                'text-base leading-none p-1 rounded-full hover:scale-125 hover:bg-secondary transition-all duration-100 active:scale-95',
                reactions[emoji]?.byCurrentUser && 'bg-primary/10'
              )}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Existing reactions on the message */}
      {existingEmojis.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {existingEmojis.map(r => (
            <Tooltip key={r.emoji}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onReact(messageId, r.emoji)}
                  className={cn(
                    'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all',
                    r.byCurrentUser
                      ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                      : 'bg-secondary/60 border-border/40 hover:bg-secondary'
                  )}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {r.count} réaction{r.count > 1 ? 's' : ''}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
};
