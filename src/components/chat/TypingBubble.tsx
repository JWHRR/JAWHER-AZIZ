import React from 'react';
import { cn } from '@/lib/utils';

interface TypingBubbleProps {
  label: string | null;
}

export const TypingBubble: React.FC<TypingBubbleProps> = ({ label }) => {
  if (!label) return null;

  return (
    <div
      className={cn(
        'flex items-end gap-2 max-w-xs',
        'animate-in fade-in slide-in-from-bottom-2 duration-150'
      )}
    >
      <div className="flex items-center gap-1.5 bg-[#F0F2F5] px-3.5 py-2.5 rounded-[18px] rounded-bl-[4px] shadow-xs">
        <span className="flex gap-1 items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8A8D91] animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#8A8D91] animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#8A8D91] animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
};
