import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Section primitive: Collapsible accordion section
 */
export default function Section({
  title,
  icon: Icon,
  badge,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
  children,
  className = '',
}) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : uncontrolledIsOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    } else {
      setUncontrolledIsOpen(!isOpen);
    }
  };

  return (
    <div className={`border-b border-border-subtle ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-content-secondary hover:text-content-primary hover:bg-surface-raised transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={`w-4 h-4 text-content-muted shrink-0 transition-transform duration-fast ${
              isOpen ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          />
          {Icon && <Icon className="w-4 h-4 text-content-muted shrink-0" aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </div>
        {badge != null && (
          <span className="text-xs text-content-muted shrink-0 ml-2">
            {badge}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}
