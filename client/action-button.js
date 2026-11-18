import React from 'react';

const h = React.createElement;

/** The same two-second delay applies to pointer hover and keyboard focus. */
export function ActionButton({ hint, hintId, active = true, variant = 'compact', children, onClick, ...props }) {
  const [visible, setVisible] = React.useState(false);
  const [left, setLeft] = React.useState(0);
  const anchor = React.useRef(null);
  const timer = React.useRef(null);
  const hide = () => { clearTimeout(timer.current); timer.current = null; setVisible(false); };
  const start = () => {
    clearTimeout(timer.current);
    if (!active) return;
    timer.current = setTimeout(() => {
      const rect = anchor.current?.getBoundingClientRect();
      if (rect) {
        const viewport = anchor.current.ownerDocument.documentElement.clientWidth;
        const width = Math.min(280, viewport - 24);
        setLeft(Math.max(12 - rect.left, Math.min(0, viewport - 12 - rect.left - width)));
      }
      setVisible(true);
    }, 2000);
  };
  React.useEffect(() => {
    if (!active) hide();
    return () => clearTimeout(timer.current);
  }, [active]);
  return h('span', { className: 'bxf-action-tip', ref: anchor,
    onMouseEnter: start, onMouseLeave: hide, onFocus: start, onBlur: hide,
    onKeyDown: (event) => { if (event.key === 'Escape') hide(); },
  }, h('button', { type: 'button', className: variant === 'compact' ? 'bxf-mini' : 'bxf-button',
    'data-variant': variant, ...props, 'aria-describedby': hintId,
    onClick: (event) => { hide(); return onClick?.(event); },
  }, children),
  h('span', { id: hintId, role: 'tooltip', className: 'bxf-action-tip-body', hidden: !visible || !active, style: { left } }, hint));
}
