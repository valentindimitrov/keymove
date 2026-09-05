import { render } from '@testing-library/react';
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

test('handles Tab before a page element can swallow the bubbling event', () => {
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
  });
  pageInput.dispatchEvent(tabEvent);

  expect(handleShortcut).toHaveBeenCalledWith('next_match', tabEvent);
  expect(tabEvent.defaultPrevented).toBe(true);
});

test('maps Shift+Tab to the previous match in capture phase', () => {
  const handleShortcut = vi.fn((_shortcutName: string, event: KeyboardEvent) =>
    event.preventDefault(),
  );
  render(<KeyboardShortcutHarness handleShortcut={handleShortcut} />);

  const pageButton = document.createElement('button');
  pageButton.addEventListener('keydown', event => event.stopPropagation());
  document.body.appendChild(pageButton);

  const tabEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code: 'Tab',
    key: 'Tab',
    shiftKey: true,
  });
  pageButton.dispatchEvent(tabEvent);

  expect(handleShortcut).toHaveBeenCalledWith('previous_match', tabEvent);
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
