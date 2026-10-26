import React from 'react';

/**
 * IconButton primitive
 * Requires aria-label for accessibility
 */
export default function IconButton({
  icon: Icon,
  'aria-label': ariaLabel,
  ariaLabel: ariaLabelAlt,
  title,
  variant = 'ghost',
  size = 16,
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  const label = ariaLabel || ariaLabelAlt || title;
  if (!label && import.meta.env?.DEV) {
    console.warn('IconButton rendered without an aria-label or title.');
  }

  const baseClasses = 'inline-flex items-center justify-center rounded-sm border transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:cursor-not-allowed';

  const sizeClasses = size === 20
    ? 'w-8 h-8 p-1.5'
    : 'w-7 h-7 p-1';

  const iconSize = size === 20 ? 'w-5 h-5' : 'w-4 h-4';

  const variantClasses = {
    ghost: 'bg-transparent hover:bg-surface-raised text-content-secondary hover:text-content-primary border-transparent',
    secondary: 'bg-surface-raised hover:bg-surface-overlay text-content-primary border-border-default hover:border-border-strong',
    danger: 'bg-status-danger-subtle hover:bg-red-950/40 text-red-400 border-red-500/30',
  }[variant] || '';

  return (
    <button
      type="button"
      aria-label={label || 'action'}
      title={title || label}
      disabled={disabled}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {Icon && <Icon className={iconSize} aria-hidden="true" />}
    </button>
  );
}
