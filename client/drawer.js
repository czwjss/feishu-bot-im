import React from 'react';
import { t } from './shared.js';

const h = React.createElement;

/** Native modal semantics keep focus in the drawer; its owner decides when drafts can close. */
export function Drawer({ open, title, onClose, children }) {
  const ref = React.useRef(null);
  const composingRef = React.useRef(false);
  const backdropDownRef = React.useRef(false);
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return h('dialog', {
    ref, hidden: !open, className: 'bxf-drawer', 'aria-label': title,
    onCompositionStartCapture: () => { composingRef.current = true; },
    onCompositionEndCapture: () => { composingRef.current = false; },
    onCancel: (event) => {
      event.preventDefault();
      if (!composingRef.current && !event.isComposing) void onClose();
    },
    onPointerDown: (event) => { backdropDownRef.current = event.target === event.currentTarget; },
    onClick: (event) => {
      const fromBackdrop = backdropDownRef.current;
      backdropDownRef.current = false;
      if (event.target === event.currentTarget && fromBackdrop) void onClose();
    },
  }, h('div', { className: 'bxf-drawer-sheet' },
    h('header', { className: 'bxf-drawer-header' }, h('h2', null, title),
      h('button', { type: 'button', className: 'bxf-mini bxf-work-icon',
        'aria-label': t('收起面板', 'Close panel'), onClick: () => void onClose(),
      }, '×')),
    h('div', { className: 'bxf-drawer-body' }, children)));
}
