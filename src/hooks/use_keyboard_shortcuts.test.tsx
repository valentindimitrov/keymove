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
