import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EXTENSION_NAME } from '../../extension_identity.js';
import InfoDropdown from './info_dropdown.js';
import VisibilityButton from './visibility_button.js';

vi.mock('./tooltip.js', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const toggleAutoHide = vi.fn();

test('exposes the visibility control as a labelled button', () => {
  render(<VisibilityButton autoHide={false} toggleAutoHide={toggleAutoHide} />);

  const button = screen.getByRole('button', { name: 'Turn Autohide on' });
  fireEvent.click(button);

  expect(toggleAutoHide).toHaveBeenCalled();
});

test('opens and closes the shortcuts panel from the keyboard-accessible button', () => {
  render(<InfoDropdown />);
  const button = screen.getByRole('button', { name: `${EXTENSION_NAME} keyboard shortcuts` });

  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('keeps settings and the contact link out of the in-page panel', () => {
  render(<InfoDropdown />);
  fireEvent.click(screen.getByRole('button', { name: `${EXTENSION_NAME} keyboard shortcuts` }));

  // Both moved to the toolbar popup, so nothing here should offer them.
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});

test('Escape inside the panel closes it and returns focus to its button', () => {
  render(<InfoDropdown />);
  const button = screen.getByRole('button', { name: `${EXTENSION_NAME} keyboard shortcuts` });
  fireEvent.click(button);
  fireEvent.keyDown(screen.getByText('Keyboard Shortcuts'), { key: 'Escape' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveFocus();
});
