import React from 'react';

/**
 * Button primitive
 * @param {'primary' | 'secondary' | 'ghost' | 'danger'} variant
 * @param {'sm' | 'md'} size
 */
export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-sm border transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2.5 py-1 gap-1.5 h-7'
    : 'text-sm px-3.5 py-1.5 gap-2 h-9';

  const variantClasses = {
    primary: 'bg-accent hover:bg-accent-hover text-white border-transparent shadow-sm',
    secondary: 'bg-surface-raised hover:bg-surface-overlay text-content-primary border-border-default hover:border-border-strong',
    ghost: 'bg-transparent hover:bg-surface-raised text-content-secondary hover:text-content-primary border-transparent',
    danger: 'bg-status-danger-subtle hover:bg-red-950/40 text-red-400 border-red-500/30 hover:border-red-500/50',
  }[variant] || '';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
