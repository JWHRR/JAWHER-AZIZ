import React from 'react';
import { cn } from '@/lib/utils';

interface OnlineDotProps {
  isOnline: boolean;
  className?: string;
}

export const OnlineDot: React.FC<OnlineDotProps> = ({ isOnline, className }) => (
  <span
    className={cn(
      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background transition-colors duration-500",
      isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
      className
    )}
  />
);
