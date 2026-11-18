import React from 'react';
import { t } from './shared.js';

const h = React.createElement;

export function ActionMenu({ disabled, active, label = t('更多操作', 'More actions'), renderActions }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const trigger = React.useRef(null);
  React.useEffect(() => { if (!active) setOpen(false); }, [active]);
  React.useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false); trigger.current?.focus();
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [open]);
  return h('div', { className: 'bxf-bot-more', ref,
    onBlur: (event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); },
  }, h('button', { ref: trigger, type: 'button', className: 'bxf-mini bxf-work-icon', disabled,
    'aria-label': label, 'aria-expanded': open, onClick: () => setOpen((value) => !value),
  }, '…'),
  open && h('div', { className: 'bxf-bot-more-panel', role: 'group', 'aria-label': label },
    renderActions(() => setOpen(false))));
}
