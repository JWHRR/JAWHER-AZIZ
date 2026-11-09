import React from 'react';
import { cn } from '@/lib/utils';

interface OnlineDotProps {
  isOnline: boolean;
  className?: string;
}

export const OnlineDot: React.FC<OnlineDotProps> = ({ isOnline, className }) => (
  <span
    className={cn(
      'absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-[#242526] transition-colors duration-300',
      isOnline ? 'bg-[#31A24C]' : 'bg-gray-300 dark:bg-gray-600',
      className
    )}
  />
);
