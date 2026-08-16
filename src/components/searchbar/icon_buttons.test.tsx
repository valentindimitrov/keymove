import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import InfoDropdown from './info_dropdown.js';
import VisibilityButton from './visibility_button.js';

vi.mock('./tooltip.js', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const settingsProps = {
  autoHide: false,
  toggleAutoHide: vi.fn(),
  useOnEveryWebsite: true,
  toggleUseOnEveryWebsite: vi.fn(),
  alwaysOn: true,
  toggleAlwaysOn: vi.fn(),
};

test('exposes the visibility control as a labelled button', () => {
  render(<VisibilityButton autoHide={false} toggleAutoHide={settingsProps.toggleAutoHide} />);

  const button = screen.getByRole('button', { name: 'Turn Autohide on' });
  fireEvent.click(button);

  expect(settingsProps.toggleAutoHide).toHaveBeenCalled();
});

test('opens and closes help and settings from the keyboard-accessible button', () => {
  render(<InfoDropdown {...settingsProps} temporarilyEnabled={false} />);
  const button = screen.getByRole('button', { name: 'YipYip help and settings' });

  expect(button).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getAllByRole('checkbox')[0]!);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
});
