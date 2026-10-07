import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  showCloseButton?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  maxWidth,
  children,
  showCloseButton = true,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeKey = maxWidth || size;
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-5xl',
    full: 'max-w-[95vw] h-[90vh]',
  }[sizeKey] || 'max-w-lg';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`bg-stone-900 border border-stone-700/80 w-full ${sizeClasses} rounded-3xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 ${className}`}
      >
        {(title || showCloseButton) && !childrenAreProvidingHeader(children) && (
          <div className="px-6 py-4 bg-stone-900 border-b border-stone-800 flex items-center justify-between shrink-0">
            <div>
              {title && <h3 className="font-black text-lg text-stone-100 tracking-tight">{title}</h3>}
              {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-stone-100 hover:bg-stone-750 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};

// Helper to check if children already has a ModalHeader
function childrenAreProvidingHeader(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && (child.type === ModalHeader)
  );
}

export const ModalHeader: React.FC<{
  title?: string;
  description?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}> = ({ title, description, onClose, children, className = '' }) => (
  <div className={`px-6 py-4 bg-stone-900 border-b border-stone-800 flex items-center justify-between shrink-0 ${className}`}>
    <div>
      {title && <h3 className="font-black text-lg text-stone-100 tracking-tight">{title}</h3>}
      {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
      {children}
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="w-8 h-8 rounded-xl bg-stone-800 text-stone-400 hover:text-stone-100 hover:bg-stone-750 flex items-center justify-center transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

export const ModalTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`font-black text-lg text-stone-100 tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const ModalContent: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className = '', children }) => {
  return (
    <div className={`p-6 overflow-y-auto space-y-4 text-xs text-stone-300 ${className}`}>
      {children}
    </div>
  );
};

export const ModalBody = ModalContent;

export const ModalFooter: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className = '', children }) => {
  return (
    <div
      className={`px-6 py-4 bg-stone-950/80 border-t border-stone-800 flex items-center justify-end gap-3 shrink-0 ${className}`}
    >
      {children}
    </div>
  );
};
