import React from 'react';
import { Loader2, AlertTriangle, Inbox, Info } from 'lucide-react';
import Button from './Button';

/**
 * StateMessage primitive
 * Consistent display for loading, empty, error, and unavailable states
 */
export default function StateMessage({
  type = 'empty',
  title,
  message,
  hint,
  actionLabel,
  onAction,
  className = '',
}) {
  const iconConfig = {
    loading: {
      Icon: Loader2,
      iconClass: 'text-accent animate-spin',
      borderClass: 'border-border-subtle',
    },
    error: {
      Icon: AlertTriangle,
      iconClass: 'text-red-400',
      borderClass: 'border-red-500/20 bg-red-500/5',
    },
    empty: {
      Icon: Inbox,
      iconClass: 'text-content-muted',
      borderClass: 'border-border-subtle',
    },
    unavailable: {
      Icon: Info,
      iconClass: 'text-amber-400',
      borderClass: 'border-amber-500/20 bg-amber-500/5',
    },
  }[type] || {
    Icon: Inbox,
    iconClass: 'text-content-muted',
    borderClass: 'border-border-subtle',
  };

  const { Icon, iconClass, borderClass } = iconConfig;

  return (
    <div className={`flex flex-col items-center justify-center p-6 text-center rounded-sm border ${borderClass} bg-surface-panel/40 ${className}`}>
      <div className="w-10 h-10 rounded-sm bg-surface-raised border border-border-default flex items-center justify-center mb-3">
        <Icon className={`w-5 h-5 ${iconClass}`} aria-hidden="true" />
      </div>

      {title && (
        <h4 className="text-sm font-semibold text-content-primary mb-1">
          {title}
        </h4>
      )}

      {message && (
        <p className="text-xs text-content-secondary max-w-sm leading-relaxed mb-1">
          {message}
        </p>
      )}

      {hint && (
        <p className="text-xs text-content-muted max-w-sm leading-relaxed mt-1">
          {hint}
        </p>
      )}

      {actionLabel && onAction && (
        <div className="mt-4">
          <Button
            size="sm"
            variant={type === 'error' ? 'danger' : 'secondary'}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
