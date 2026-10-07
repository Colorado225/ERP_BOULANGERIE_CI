import React, { useState, useRef, useEffect, createContext, useContext } from 'react';

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

export interface DropdownProps {
  children: React.ReactNode;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = () => setIsOpen(false);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, close }}>
      <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

export const DropdownTrigger: React.FC<{
  children: React.ReactNode;
  asChild?: boolean;
}> = ({ children }) => {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownTrigger must be used within a Dropdown');

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        ctx.setIsOpen((prev) => !prev);
      }}
      className="cursor-pointer inline-flex items-center"
    >
      {children}
    </div>
  );
};

export interface DropdownMenuProps {
  align?: 'left' | 'right';
  width?: string;
  className?: string;
  children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  align = 'right',
  width = 'w-56',
  className = '',
  children,
}) => {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownMenu must be used within a Dropdown');

  if (!ctx.isOpen) return null;

  const alignmentClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div
      className={`absolute ${alignmentClass} mt-2 ${width} rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl shadow-black/80 p-1.5 z-50 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100 ${className}`}
    >
      {children}
    </div>
  );
};

export interface DropdownItemProps {
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'amber';
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  icon,
  onClick,
  disabled = false,
  variant = 'default',
  badge,
  className = '',
  children,
}) => {
  const ctx = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (onClick) onClick();
    ctx?.close();
  };

  const variantStyles = {
    default: 'text-stone-300 hover:text-stone-100 hover:bg-stone-800/80',
    amber: 'text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 font-bold',
    danger: 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 font-semibold',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors text-left ${
        disabled
          ? 'opacity-40 cursor-not-allowed text-stone-500'
          : variantStyles[variant]
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 truncate">
        {icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>}
        <span className="truncate">{children}</span>
      </div>
      {badge && <span className="ml-2 shrink-0">{badge}</span>}
    </button>
  );
};

export const DropdownDivider: React.FC = () => {
  return <div className="h-px bg-stone-800 my-1 -mx-1" />;
};

export const DropdownLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
      {children}
    </div>
  );
};

export interface SelectDropdownOption {
  label: string;
  value: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface SelectDropdownProps {
  options: SelectDropdownOption[];
  value: string;
  onChange: (val: string) => void;
  width?: string;
  className?: string;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  options,
  value,
  onChange,
  width = 'w-56',
  className = '',
}) => {
  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <Dropdown className={className}>
      <DropdownTrigger>
        <button
          type="button"
          className="flex items-center justify-between gap-2 bg-stone-800/80 hover:bg-stone-750 border border-stone-700/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-200 transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            {selectedOption?.icon}
            <span className="truncate">{selectedOption?.label}</span>
          </div>
          <span className="text-stone-400 text-[10px]">▼</span>
        </button>
      </DropdownTrigger>
      <DropdownMenu align="left" width={width}>
        {options.map((opt) => (
          <DropdownItem
            key={opt.value}
            icon={opt.icon}
            onClick={() => onChange(opt.value)}
            variant={opt.value === value ? 'amber' : 'default'}
            badge={
              opt.badge ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {opt.badge}
                </span>
              ) : undefined
            }
          >
            {opt.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};


