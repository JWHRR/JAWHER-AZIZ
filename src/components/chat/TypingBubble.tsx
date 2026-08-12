import React from 'react';
import { cn } from '@/lib/utils';

interface TypingBubbleProps {
  label: string | null;
}

export const TypingBubble: React.FC<TypingBubbleProps> = ({ label }) => {
  if (!label) return null;

  return (
    <div className={cn(
      "flex items-end gap-2 max-w-xs",
      "animate-in fade-in slide-in-from-bottom-2 duration-200"
    )}>
      <div className="flex items-center gap-1.5 bg-secondary/80 text-secondary-foreground text-xs px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm border border-white/5">
        <span className="flex gap-1 items-center mr-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
        </span>
        <span className="text-muted-foreground italic">{label}</span>
      </div>
    </div>
  );
};
