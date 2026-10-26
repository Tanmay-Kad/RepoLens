import React from 'react';

/**
 * PanelHeader primitive
 */
export default function PanelHeader({
  title,
  subtitle,
  icon: Icon,
  badge,
  actions,
  className = '',
}) {
  return (
    <div className={`h-11 px-3.5 border-b border-border-subtle bg-surface-panel flex items-center justify-between gap-2 shrink-0 select-none ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-content-muted shrink-0" aria-hidden="true" />}
        <span className="text-xs font-semibold uppercase tracking-wider text-content-primary truncate">
          {title}
        </span>
        {badge != null && (
          <span className="text-xs font-normal text-content-muted">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <span className="text-xs text-content-muted truncate hidden sm:inline">
          {subtitle}
        </span>
      )}
      {actions && (
        <div className="flex items-center gap-1 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
