import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import EXTENSION_IDENTITY, { EXTENSION_NAME } from '../../extension_identity.js';
import InfoDropdown from './info_dropdown.js';
import VisibilityButton from './visibility_button.js';

vi.mock('./tooltip.js', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const settingsProps = {
  autoHide: false,
  toggleAutoHide: vi.fn(),
  alwaysOn: true,
  toggleAlwaysOn: vi.fn(),
  startInActionMode: false,
  toggleStartInActionMode: vi.fn(),
  resetPopupPosition: vi.fn(),
};

test('exposes the visibility control as a labelled button', () => {
  render(<VisibilityButton autoHide={false} toggleAutoHide={settingsProps.toggleAutoHide} />);

  const button = screen.getByRole('button', { name: 'Turn Autohide on' });
  fireEvent.click(button);

  expect(settingsProps.toggleAutoHide).toHaveBeenCalled();
});

test('opens and closes help and settings from the keyboard-accessible button', () => {
  render(<InfoDropdown {...settingsProps} />);
  const button = screen.getByRole('button', { name: `${EXTENSION_NAME} help and settings` });

  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('link', { name: `Contact ${EXTENSION_NAME}` })).toHaveAttribute(
    'href',
    EXTENSION_IDENTITY.contactUrl,
  );
  expect(screen.getAllByRole('link')).toHaveLength(1);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Always on' }));
  expect(button).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Reset popup position' }));
  expect(settingsProps.resetPopupPosition).toHaveBeenCalled();
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('Escape inside the settings panel closes it and returns focus to its button', () => {
  render(<InfoDropdown {...settingsProps} />);
  const button = screen.getByRole('button', { name: `${EXTENSION_NAME} help and settings` });
  fireEvent.click(button);
  const checkbox = screen.getByRole('checkbox', { name: 'Always on' });
  fireEvent.keyDown(checkbox, { key: 'Escape' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveFocus();
});
