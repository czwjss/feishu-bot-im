import React from 'react';

const h = React.createElement;

/** Do not load unavailable settings; retain mounted drafts across disconnections. */
export function StatusSettings({ visible, title, children }) {
  const [visited, setVisited] = React.useState(visible);
  React.useEffect(() => { if (visible) setVisited(true); }, [visible]);
  if (!visible && !visited) return null;
  return h('section', { className: 'bxf-status-settings', hidden: !visible, 'aria-label': title },
    h('h3', null, title), children);
}
