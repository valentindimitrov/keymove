import { render, screen, within } from '@testing-library/react';
import InfoPanelKeyboardShortcuts from './info_panel_keyboard_shortcuts.js';

test('shows Shift+Tab as the shortcut for the previous match', () => {
  render(<InfoPanelKeyboardShortcuts />);

  const description = screen.getByText('to jump to the previous match');
  const shortcutRow = description.parentElement!;

  expect(within(shortcutRow).getByText('Shift')).toBeInTheDocument();
  expect(within(shortcutRow).getByText('Tab')).toBeInTheDocument();
});
