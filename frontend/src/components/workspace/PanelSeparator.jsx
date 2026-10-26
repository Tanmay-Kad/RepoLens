import { useCallback } from 'react';

/**
 * Accessible, draggable panel resize separator
 */
export default function PanelSeparator({
  position = 'left', // 'left' separator resizes sidebar, 'right' resizes details panel
  size,
  minSize = 220,
  maxSize = 480,
  defaultSize = 300,
  onResize,
  disabled = false,
  className = '',
}) {
  const handlePointerDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    const startX = e.clientX;
    const startSize = size;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onPointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newSize;
      if (position === 'left') {
        newSize = startSize + deltaX;
      } else {
        newSize = startSize - deltaX;
      }
      const clamped = Math.max(minSize, Math.min(maxSize, newSize));
      onResize(clamped);
    };

    const onPointerUp = (upEvent) => {
      try {
        target.releasePointerCapture(upEvent.pointerId);
      } catch {
        // Ignore if already released
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [disabled, size, position, minSize, maxSize, onResize]);

  const handleKeyDown = (e) => {
    if (disabled) return;
    let step = 0;
    if (e.key === 'ArrowLeft') {
      step = position === 'left' ? -10 : 10;
    } else if (e.key === 'ArrowRight') {
      step = position === 'left' ? 10 : -10;
    } else if (e.key === 'Home') {
      onResize(minSize);
      return;
    } else if (e.key === 'End') {
      onResize(maxSize);
      return;
    }

    if (step !== 0) {
      e.preventDefault();
      const clamped = Math.max(minSize, Math.min(maxSize, size + step));
      onResize(clamped);
    }
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    onResize(defaultSize);
  };

  return (
    <div
      role="separator"
      tabIndex={disabled ? -1 : 0}
      aria-orientation="vertical"
      aria-valuenow={Math.round(size)}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      aria-label={`${position === 'left' ? 'Sidebar' : 'Details panel'} resizer`}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize, double-click to reset"
      className={`w-1.5 hover:w-2 -mx-0.5 bg-transparent hover:bg-accent/40 active:bg-accent transition-all duration-fast cursor-col-resize select-none shrink-0 z-30 focus-visible:outline-none focus-visible:bg-accent/60 ${className}`}
    />
  );
}
