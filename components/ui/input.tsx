import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex w-full rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';


