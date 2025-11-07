import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex w-full min-h-[96px] rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';


