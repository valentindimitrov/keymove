import { render, screen, within } from '@testing-library/react';
import { keyboardShortcuts } from '../../../lib/static_data.js';
import InfoPanelKeyboardShortcuts from './info_panel_keyboard_shortcuts.js';

const openingText = keyboardShortcuts.find(shortcut => shortcut.name === 'focus_searchbar')!.text!;

function keysInRow(text: string) {
  const row = screen.getByText(text).parentElement!;
  return [...row.querySelectorAll('.keymove-info-panel-shortcut-key')].map(key => key.textContent);
}

test('shows the configured opening shortcut instead of the default one', () => {
  render(
    <InfoPanelKeyboardShortcuts
      openingShortcut={{
        code: 'KeyK',
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      }}
    />,
  );

  expect(keysInRow(openingText)).toEqual(['Control', 'Shift', 'K']);
});

test('leaves out only the opening shortcut when asked to', () => {
  render(<InfoPanelKeyboardShortcuts omitOpening />);

  expect(screen.queryByText(openingText)).not.toBeInTheDocument();
  expect(screen.getByText('to select the next matching action')).toBeInTheDocument();
});

test('separates the keys of a multi-key shortcut', () => {
  render(<InfoPanelKeyboardShortcuts />);

  const row = screen.getByText('to select the previous matching action').parentElement!;
  expect(within(row).getAllByText('+')).toHaveLength(2);
});
