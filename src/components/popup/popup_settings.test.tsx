import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PopupSettings from './popup_settings.js';

const storage = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: { get: storage.get, set: storage.set },
      onChanged: { addListener: storage.addListener, removeListener: storage.removeListener },
    },
  },
}));

beforeEach(() => {
  storage.set.mockReset().mockResolvedValue(undefined);
  storage.get.mockReset().mockResolvedValue({});
});

test('shows the settings the searchbar panel no longer carries', async () => {
  render(<PopupSettings />);

  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Always on' })).toBeChecked());
  expect(screen.getByRole('checkbox', { name: 'Start in action mode' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Show autohide button' })).toBeInTheDocument();
  expect(screen.getByLabelText('Action highlight colour')).toHaveValue('#a78bfa');
  expect(screen.getByRole('link', { name: /Contact/ })).toBeInTheDocument();
});

test('writes a toggle straight to storage, which every open tab already watches', async () => {
  render(<PopupSettings />);
  await waitFor(() => expect(storage.get).toHaveBeenCalled());

  fireEvent.click(screen.getByRole('checkbox', { name: 'Start in action mode' }));

  expect(storage.set).toHaveBeenCalledWith({ startInActionMode: true });
});

test('writes a chosen highlight colour to storage', async () => {
  render(<PopupSettings />);
  await waitFor(() => expect(storage.get).toHaveBeenCalled());

  fireEvent.change(screen.getByLabelText('Text highlight colour'), {
    target: { value: '#22d3ee' },
  });

  expect(storage.set).toHaveBeenCalledWith({
    highlightColors: { text: '#22d3ee', actions: '#a78bfa' },
  });
});
