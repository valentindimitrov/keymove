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
  expect(screen.getByRole('checkbox', { name: 'Autohide' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Show autohide button' })).toBeInTheDocument();
  expect(screen.getByLabelText('Action highlight colour')).toHaveValue('#a78bfa');
  expect(screen.getByRole('link', { name: 'KeyMove on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/valentindimitrov/keymove',
  );
  expect(screen.getByRole('link', { name: 'Contact KeyMove Developer' })).toBeInTheDocument();
});

test('opens with a reminder of the shortcut that summons the searchbar', async () => {
  render(<PopupSettings />);
  await waitFor(() => expect(storage.get).toHaveBeenCalled());

  expect(screen.getByText(/focus the searchbar/)).toBeInTheDocument();
  expect(screen.getByText('Alt')).toBeInTheDocument();
});

test('offers nine standard positions and marks the stored one', async () => {
  storage.get.mockResolvedValue({ popupPosition: { x: 0.5, y: 0.75 } });
  render(<PopupSettings />);

  const cells = await screen.findAllByRole('button', { name: /^(Top|Middle|Bottom) / });
  expect(cells).toHaveLength(9);

  const bottomCentre = screen.getByRole('button', { name: 'Bottom centre' });
  await waitFor(() => expect(bottomCentre).toHaveAttribute('aria-pressed', 'true'));

  fireEvent.click(screen.getByRole('button', { name: 'Top left' }));
  expect(storage.set).toHaveBeenCalledWith({ popupPosition: { x: 0.25, y: 0.25 } });
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

test('resets the searchbar position and size together', async () => {
  storage.get.mockResolvedValue({ popupPosition: { x: 0.25, y: 0.25 }, popupWidth: 700 });
  render(<PopupSettings />);

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Top left' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reset position and size' }));

  await waitFor(() => {
    expect(storage.set).toHaveBeenCalledWith({ popupPosition: { x: 0.5, y: 0.75 } });
    expect(storage.set).toHaveBeenCalledWith({ popupWidth: 550 });
  });
});

test('locks position controls and persists the lock until explicitly unlocked', async () => {
  storage.get.mockResolvedValue({ lockPositionAndSize: true });
  render(<PopupSettings />);
  const lock = await screen.findByRole('checkbox', { name: 'Lock position and size' });
  await waitFor(() => expect(lock).toBeChecked());
  expect(screen.getByRole('button', { name: 'Reset position and size' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Top left' })).toBeDisabled();
  fireEvent.click(screen.getByText('Lock position and size'));
  expect(storage.set).toHaveBeenCalledWith({ lockPositionAndSize: false });
  expect(lock).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Top left' })).toBeEnabled();
  fireEvent.click(lock);
  expect(storage.set).toHaveBeenCalledWith({ lockPositionAndSize: true });
  expect(lock).toBeChecked();
  expect(screen.getByRole('button', { name: 'Reset position and size' })).toBeDisabled();
});

test('stores the requested suggestion count without saving an empty or invalid input', async () => {
  render(<PopupSettings />);
  const count = screen.getByRole('spinbutton', { name: 'Number of suggestions' });
  await waitFor(() => expect(count).toHaveValue(3));
  expect(count).toHaveAttribute('max', '5');
  fireEvent.change(count, { target: { value: '5' } });
  expect(storage.set).toHaveBeenCalledWith({ suggestionCount: 5 });
  storage.set.mockClear();
  fireEvent.change(count, { target: { value: '6' } });
  expect(storage.set).not.toHaveBeenCalled();
  fireEvent.blur(count);
  expect(count).toHaveValue(5);
  fireEvent.change(count, { target: { value: '' } });
  expect(storage.set).not.toHaveBeenCalled();
  fireEvent.blur(count);
  expect(count).toHaveValue(5);
});
