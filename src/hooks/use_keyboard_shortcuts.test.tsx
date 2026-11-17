import { render } from '@testing-library/react';
import React from 'react';
import useKeyboardShortcuts from './use_keyboard_shortcuts.js';

function KeyboardShortcutHarness({
  handleShortcut,
}: {
  handleShortcut: (shortcutName: string, event: KeyboardEvent) => void;
}) {
  useKeyboardShortcuts(handleShortcut);
  return null;
}

afterEach(() => {
  document.body.innerHTML = '';
});

test('installs current shortcuts before a committed UI can receive input', () => {
  function ImmediateShortcut({
    handler,
  }: {
    handler: (name: string, event: KeyboardEvent) => void;
  }) {
    useKeyboardShortcuts(handler);
    React.useLayoutEffect(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'f',
          code: 'KeyF',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, [handler]);
    return null;
  }
  const initial = vi.fn();
  const updated = vi.fn();
  const { rerender } = render(<ImmediateShortcut handler={initial} />);
  expect(initial).toHaveBeenCalledWith('focus_searchbar', expect.any(KeyboardEvent));
  rerender(<ImmediateShortcut handler={updated} />);
  expect(initial).toHaveBeenCalledTimes(1);
  expect(updated).toHaveBeenCalledWith('focus_searchbar', expect.any(KeyboardEvent));
});

// Handled in the capture phase, before a page element can swallow the bubbling event.
test.each([
  { shiftKey: false, shortcut: 'next_match' },
  { shiftKey: true, shortcut: 'previous_match' },
])('maps Tab with shift=$shiftKey before the page can stop it', ({ shiftKey, shortcut }) => {
  const handleShortcut = vi.fn((_shortcutName: string, event: KeyboardEvent) =>
    event.preventDefault(),
  );
  render(<KeyboardShortcutHarness handleShortcut={handleShortcut} />);

  const pageInput = document.createElement('input');
  pageInput.addEventListener('keydown', event => event.stopPropagation());
  document.body.appendChild(pageInput);

  const tabEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    shiftKey,
  });
  pageInput.dispatchEvent(tabEvent);

  expect(handleShortcut).toHaveBeenCalledWith(shortcut, tabEvent);
  expect(tabEvent.defaultPrevented).toBe(true);
});

test.each([
  { shiftKey: false, shortcut: 'next_action_match' },
  { shiftKey: true, shortcut: 'previous_action_match' },
])('maps Ctrl+Tab action navigation with shift=$shiftKey', ({ shiftKey, shortcut }) => {
  const handleShortcut = vi.fn((_shortcutName: string, event: KeyboardEvent) =>
    event.preventDefault(),
  );
  render(<KeyboardShortcutHarness handleShortcut={handleShortcut} />);

  const tabEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    ctrlKey: true,
    shiftKey,
  });
  document.body.dispatchEvent(tabEvent);

  expect(handleShortcut).toHaveBeenCalledWith(shortcut, tabEvent);
  expect(tabEvent.defaultPrevented).toBe(true);
});

test.each([
  {
    shiftKey: false,
    ctrlKey: false,
    shortcut: 'select_match',
  },
  {
    shiftKey: true,
    ctrlKey: false,
    shortcut: 'open_match_in_foreground_tab',
  },
  {
    shiftKey: false,
    ctrlKey: true,
    shortcut: 'open_match_in_background_tab',
  },
])('maps Enter modifiers to $shortcut', ({ shiftKey, ctrlKey, shortcut }) => {
  const handleShortcut = vi.fn();
  render(<KeyboardShortcutHarness handleShortcut={handleShortcut} />);

  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Enter',
    key: 'Enter',
    shiftKey,
    ctrlKey,
  });
  document.body.dispatchEvent(enterEvent);

  expect(handleShortcut).toHaveBeenCalledWith(shortcut, enterEvent);
});

test('maps the native copy command to the explicit copy shortcut name', () => {
  const handleShortcut = vi.fn();
  render(<KeyboardShortcutHarness handleShortcut={handleShortcut} />);

  const copyEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'KeyC',
    key: 'c',
    ctrlKey: true,
  });
  document.body.dispatchEvent(copyEvent);

  expect(handleShortcut).toHaveBeenCalledWith('copy_selected_link', copyEvent);
  expect(copyEvent.defaultPrevented).toBe(false);
});
