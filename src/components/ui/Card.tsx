import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'interactive' | 'warning' | 'danger';
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-stone-900 border border-stone-800 shadow-md',
    elevated: 'bg-stone-900/95 border border-stone-800 shadow-xl shadow-black/40',
    glass: 'bg-stone-900/80 backdrop-blur-md border border-stone-800/80 shadow-lg',
    interactive:
      'bg-stone-900 border border-stone-800 hover:border-amber-500/40 hover:bg-stone-850 cursor-pointer transition-all active:scale-[0.99] shadow-md',
    warning: 'bg-amber-950/20 border border-amber-800/60 text-amber-200 shadow-md',
    danger: 'bg-rose-950/20 border border-rose-800/60 text-rose-200 shadow-md',
  };

  return (
    <div
      className={`rounded-3xl transition-colors ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  className = '',
  action,
  children,
  ...props
}) => {
  return (
    <div
      className={`p-5 sm:p-6 border-b border-stone-800/80 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      <div className="space-y-1 min-w-0">{children}</div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
};

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const CardTitle: React.FC<CardTitleProps> = ({
  className = '',
  icon,
  children,
  ...props
}) => {
  return (
    <h3
      className={`font-black text-base text-stone-100 flex items-center gap-2 tracking-tight ${className}`}
      {...props}
    >
      {icon && <span className="text-amber-400 shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </h3>
  );
};

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
  children: React.ReactNode;
}

export const CardDescription: React.FC<CardDescriptionProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <p className={`text-xs text-stone-400 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const CardContent: React.FC<CardContentProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`p-4 sm:p-5 border-t border-stone-800/80 bg-stone-950/40 rounded-b-3xl flex items-center justify-between text-xs text-stone-400 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  color?: 'amber' | 'emerald' | 'sky' | 'orange' | 'purple' | 'rose';
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  badge,
  color = 'amber',
  className = '',
  onClick,
}) => {
  const colorMap = {
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    sky: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-stone-900 border border-stone-800 p-5 rounded-3xl space-y-2 hover:border-amber-500/30 transition-all shadow-md ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between text-stone-400">
        <span className="text-[11px] font-bold uppercase tracking-wider">{title}</span>
        {icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${colorMap[color]}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-black text-stone-100">{value}</p>
        {badge}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center justify-between text-[11px] text-stone-400 pt-2 border-t border-stone-800/80">
          <span>{subtitle}</span>
          {trend && (
            <span
              className={`font-bold flex items-center gap-0.5 ${
                trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
