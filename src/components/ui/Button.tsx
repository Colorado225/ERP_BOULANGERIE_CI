import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black shadow-lg shadow-amber-500/20 active:scale-95',
    secondary:
      'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold',
    outline:
      'bg-transparent hover:bg-stone-850 text-stone-300 border border-stone-700 hover:text-stone-100 font-semibold',
    ghost:
      'bg-transparent hover:bg-stone-800 text-stone-400 hover:text-stone-100 font-medium',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-stone-100 font-bold shadow-md shadow-rose-600/20 active:scale-95',
    accent:
      'bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-stone-950 font-black shadow-lg shadow-purple-600/20 active:scale-95',
  };

  const sizeStyles = {
    xs: 'px-2.5 py-1 text-[11px] rounded-lg gap-1',
    sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
    md: 'px-4 py-2 text-xs rounded-xl gap-2 font-bold',
    lg: 'px-5 py-3 text-sm rounded-2xl gap-2.5 font-black uppercase tracking-wider',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none ${
        sizeStyles[size]
      } ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
