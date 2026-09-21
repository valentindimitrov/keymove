import { act, renderHook } from '@testing-library/react';
import type { Theme } from '../lib/stored_settings_schema.js';
import useTheme from './use_theme.js';

test('follows system changes, respects overrides, and cleans up its listener and host attribute', () => {
  const events = new EventTarget();
  const media = {
    matches: false,
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
  };
  vi.stubGlobal('matchMedia', () => media);
  const target = document.createElement('div');
  target.attachShadow({ mode: 'open' });
  const pageTheme = document.documentElement.getAttribute('data-keymove-theme');
  const { rerender, unmount } = renderHook(
    ({ theme }: { theme: Theme }) => useTheme(theme, target),
    {
      initialProps: { theme: 'system' as Theme },
    },
  );
  expect(target).toHaveAttribute('data-keymove-theme', 'light');
  act(() => {
    media.matches = true;
    events.dispatchEvent(new Event('change'));
  });
  expect(target).toHaveAttribute('data-keymove-theme', 'dark');
  rerender({ theme: 'light' });
  act(() => {
    events.dispatchEvent(new Event('change'));
  });
  expect(target).toHaveAttribute('data-keymove-theme', 'light');
  rerender({ theme: 'dark' });
  act(() => {
    media.matches = false;
    events.dispatchEvent(new Event('change'));
  });
  expect(target).toHaveAttribute('data-keymove-theme', 'dark');
  rerender({ theme: 'system' });
  expect(target).toHaveAttribute('data-keymove-theme', 'light');
  expect(document.documentElement.getAttribute('data-keymove-theme')).toBe(pageTheme);
  unmount();
  expect(target).not.toHaveAttribute('data-keymove-theme');
  expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  act(() => {
    media.matches = true;
    events.dispatchEvent(new Event('change'));
  });
  expect(target).not.toHaveAttribute('data-keymove-theme');
  vi.unstubAllGlobals();
});
