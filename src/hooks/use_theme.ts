import React from 'react';
import type { Theme } from '../lib/stored_settings_schema.js';

// The content script targets its own shadow host; the popup targets its document root.
// Portals and modal moves inherit the same tokens without touching the host page's theme.
export default function useTheme(theme: Theme, target: Element | null) {
  React.useLayoutEffect(() => {
    if (!target) return;
    const previous = target.getAttribute('data-keymove-theme');
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    const apply = () =>
      target.setAttribute(
        'data-keymove-theme',
        theme === 'light' || theme === 'dark' ? theme : media?.matches ? 'dark' : 'light',
      );
    apply();
    if (theme === 'system') media?.addEventListener('change', apply);
    return () => {
      media?.removeEventListener('change', apply);
      if (previous === null) target.removeAttribute('data-keymove-theme');
      else target.setAttribute('data-keymove-theme', previous);
    };
  }, [theme, target]);
}
