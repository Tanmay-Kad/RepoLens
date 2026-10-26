import React from 'react';

/**
 * Badge primitive
 * @param {'default' | 'entry' | 'important' | 'normal' | 'test' | 'isolated' | 'cycle' | 'danger' | 'warning' | 'success'} variant
 */
export default function Badge({
  children,
  variant = 'default',
  icon: Icon,
  className = '',
  title,
}) {
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-sm border select-none whitespace-nowrap';

  const variantClasses = {
    default: 'bg-surface-raised border-border-default text-content-secondary',
    entry: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    important: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    normal: 'bg-slate-500/10 border-slate-500/30 text-slate-300',
    test: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    isolated: 'bg-slate-700/20 border-slate-600/30 text-slate-400',
    cycle: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    danger: 'bg-red-500/10 border-red-500/30 text-red-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  }[variant] || 'bg-surface-raised border-border-default text-content-secondary';

  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`} title={title}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
