import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'amber' | 'emerald' | 'rose' | 'sky' | 'purple' | 'orange' | 'stone';
  size?: 'sm' | 'md';
  pulse?: boolean;
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'amber',
  size = 'md',
  pulse = false,
  dot = false,
  children,
  className = '',
  ...props
}) => {
  const variantStyles = {
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    stone: 'bg-stone-800 text-stone-300 border-stone-700',
  };

  const dotColors = {
    amber: 'bg-amber-400',
    emerald: 'bg-emerald-400',
    rose: 'bg-rose-400',
    sky: 'bg-sky-400',
    purple: 'bg-purple-400',
    orange: 'bg-orange-400',
    stone: 'bg-stone-400',
  };

  const sizeStyles = {
    sm: 'text-[9px] px-1.5 py-0.2',
    md: 'text-[10px] font-bold px-2 py-0.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${
        pulse ? 'animate-pulse' : ''
      } ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      <span>{children}</span>
    </span>
  );
};
