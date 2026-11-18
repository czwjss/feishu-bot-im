import React from 'react';
import source from '../icon.svg';

/** Share the packaged official icon across the sidebar and main page. */
export function FeishuIcon({ size = 20 }) {
  return React.createElement('img', {
    src: source, width: size, height: size, alt: '', 'aria-hidden': true, draggable: false,
    style: { display: 'block', objectFit: 'contain', flexShrink: 0 },
  });
}
