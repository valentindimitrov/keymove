import { render, screen, within } from '@testing-library/react';
import InfoPanelKeyboardShortcuts from './info_panel_keyboard_shortcuts.js';

test('shows both text and action navigation shortcut families', () => {
  render(<InfoPanelKeyboardShortcuts />);

  const previousTextRow = screen.getByText(
    'to select the previous matching text block',
  ).parentElement!;
  const nextActionRow = screen.getByText('to select the next matching action').parentElement!;
  const previousActionRow = screen.getByText(
    'to select the previous matching action',
  ).parentElement!;
  const foregroundTabRow = screen.getByText(
    'to open the selected link in a new tab',
  ).parentElement!;
  const backgroundTabRow = screen.getByText(
    'to open the selected link in a background tab',
  ).parentElement!;
  const copyLinkRow = screen.getByText(
    'to copy the selected link (or selected text block)',
  ).parentElement!;
  const clearSearchRow = screen.getByText('to clear the searchbar').parentElement!;

  expect(within(previousTextRow).getByText('Shift')).toBeInTheDocument();
  expect(within(previousTextRow).getByText('Tab')).toBeInTheDocument();
  expect(within(nextActionRow).getByText('Control')).toBeInTheDocument();
  expect(within(nextActionRow).getByText('Tab')).toBeInTheDocument();
  expect(within(previousActionRow).getByText('Shift')).toBeInTheDocument();
  expect(within(previousActionRow).getByText('Control')).toBeInTheDocument();
  expect(within(previousActionRow).getByText('Tab')).toBeInTheDocument();
  expect(within(foregroundTabRow).getByText('Shift')).toBeInTheDocument();
  expect(within(foregroundTabRow).getByText('Enter')).toBeInTheDocument();
  expect(within(backgroundTabRow).getByText('Control')).toBeInTheDocument();
  expect(within(backgroundTabRow).getByText('Enter')).toBeInTheDocument();
  expect(within(copyLinkRow).getByText('Control')).toBeInTheDocument();
  expect(within(copyLinkRow).getByText('C')).toBeInTheDocument();
  expect(within(clearSearchRow).getByText('Control')).toBeInTheDocument();
  expect(within(clearSearchRow).getByText('Backspace')).toBeInTheDocument();
  expect(within(clearSearchRow).queryByText('Delete')).not.toBeInTheDocument();
  expect(screen.queryByText(/autohide/i)).not.toBeInTheDocument();
});
