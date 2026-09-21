import { render, screen } from '@testing-library/react';
import ShortcutBadge from './shortcut_badge.js';
import Utils from '../../lib/utils.js';

test('shows Option on macOS and preserves compact numbers when hints are off', () => {
  const platform = vi.spyOn(Utils, 'isMacOS').mockReturnValue(true);
  try {
    const { rerender } = render(<ShortcutBadge position={6} tooltipsMode />);
    expect(screen.getByText('Option + 6')).toHaveAttribute('aria-hidden', 'true');
    rerender(<ShortcutBadge position={6} tooltipsMode={false} />);
    expect(screen.getByText('6')).toBeInTheDocument();
  } finally {
    platform.mockRestore();
  }
});
