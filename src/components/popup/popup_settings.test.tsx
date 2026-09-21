import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PopupSettings from './popup_settings.js';

const storage = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  query: vi.fn(),
  getTab: vi.fn(),
  getCurrentTab: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { getURL: () => 'chrome-extension://example/popup.html' },
    tabs: { query: storage.query, get: storage.getTab, getCurrent: storage.getCurrentTab },
    storage: {
      local: { get: storage.get, set: storage.set, remove: storage.remove },
      onChanged: { addListener: storage.addListener, removeListener: storage.removeListener },
    },
  },
}));

beforeEach(() => {
  storage.set.mockReset().mockResolvedValue(undefined);
  storage.get.mockReset().mockResolvedValue({});
  storage.remove.mockReset().mockResolvedValue(undefined);
  storage.query.mockReset().mockResolvedValue([{ url: 'https://github.com/example' }]);
  storage.getTab.mockReset().mockResolvedValue({ url: 'https://linear.app/workspace' });
  storage.getCurrentTab.mockReset().mockResolvedValue(undefined);
});

test('a settings fallback tab retains its source site and handles a closed source gracefully', async () => {
  storage.getCurrentTab.mockResolvedValue({ id: 1, openerTabId: 42 });
  storage.query.mockResolvedValue([
    { url: 'chrome-extension://example/popup.html', openerTabId: 42 },
  ]);
  const view = render(<PopupSettings />);
  fireEvent.click(screen.getByRole('tab', { name: 'Sites' }));
  expect(await screen.findByText('linear.app')).toBeInTheDocument();
  expect(storage.getTab).toHaveBeenCalledWith(42);
  view.unmount();
  storage.getTab.mockRejectedValueOnce(new Error('closed'));
  render(<PopupSettings />);
  fireEvent.click(screen.getByRole('tab', { name: 'Sites' }));
  await waitFor(() => expect(storage.getTab).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('combobox', { name: 'Site behavior' })).not.toBeInTheDocument();
});

test('a protected page does not borrow its opener site for an override', async () => {
  storage.query.mockResolvedValue([{ url: 'chrome://newtab', openerTabId: 42 }]);
  render(<PopupSettings />);
  fireEvent.click(screen.getByRole('tab', { name: 'Sites' }));
  await waitFor(() => expect(storage.query).toHaveBeenCalled());
  expect(storage.getTab).not.toHaveBeenCalled();
  expect(screen.queryByRole('combobox', { name: 'Site behavior' })).not.toBeInTheDocument();
});

test('shows every saved site override and updates only the current hostname', async () => {
  storage.get.mockResolvedValue({
    'siteBehavior:linear.app': 'paused',
    'siteBehavior:github.com': 'shortcut',
  });
  render(<PopupSettings />);
  fireEvent.click(screen.getByRole('tab', { name: 'Sites' }));
  const select = await screen.findByRole('combobox', { name: 'Site behavior' });
  await waitFor(() => expect(select).toHaveValue('shortcut'));
  expect(
    screen.getByRole('button', { name: 'Remove override for linear.app' }),
  ).toBeInTheDocument();
  fireEvent.change(select, { target: { value: 'paused' } });
  expect(storage.set).toHaveBeenCalledWith({ 'siteBehavior:github.com': 'paused' });
  fireEvent.click(screen.getByRole('button', { name: 'Remove override for github.com' }));
  expect(storage.remove).toHaveBeenCalledWith('siteBehavior:github.com');
  expect(screen.getByRole('button', { name: 'Remove override for linear.app' })).toHaveFocus();
  expect(select).toHaveValue('default');
  expect(screen.getByText('linear.app')).toBeInTheDocument();
});

test('groups settings into keyboard-accessible tabs without showing site controls in General', async () => {
  render(<PopupSettings />);
  await waitFor(() => expect(storage.get).toHaveBeenCalled());
  const general = screen.getByRole('tab', { name: 'General' });
  expect(general).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('combobox', { name: 'Site behavior' })).not.toBeInTheDocument();
  fireEvent.keyDown(general, { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Sites' })).toHaveFocus();
  expect(screen.getByRole('heading', { name: /Saved site overrides/ })).toBeInTheDocument();
});

test('offers an accessible appearance selector and applies saved choices to the popup', async () => {
  storage.get.mockResolvedValue({ theme: 'dark' });
  render(<PopupSettings />);
  fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
  const appearance = screen.getByRole('combobox', { name: 'Appearance' });
  await waitFor(() => expect(appearance).toHaveValue('dark'));
  expect(appearance).toHaveAccessibleDescription(
    'System follows your device’s light or dark appearance.',
  );
  expect(document.documentElement).toHaveAttribute('data-keymove-theme', 'dark');
  fireEvent.change(appearance, { target: { value: 'light' } });
  expect(storage.set).toHaveBeenCalledWith({ theme: 'light' });
  expect(document.documentElement).toHaveAttribute('data-keymove-theme', 'light');
});

test('shows the settings the searchbar panel no longer carries', async () => {
  render(<PopupSettings />);

  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Default activation' })).toHaveValue('type'),
  );
  expect(screen.getByRole('checkbox', { name: 'Start in action mode' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Autohide' })).toBeChecked();
  fireEvent.change(screen.getByRole('combobox', { name: 'Default activation' }), {
    target: { value: 'shortcut' },
  });
  expect(storage.set).toHaveBeenCalledWith({ alwaysOn: false });
  fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
  expect(screen.getByRole('checkbox', { name: 'Show autohide button' })).toBeInTheDocument();
  expect(screen.getByLabelText('Action highlight colour')).toHaveValue('#a78bfa');
  expect(screen.getByRole('link', { name: 'KeyMove on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/valentindimitrov/keymove',
  );
  const supportLink = screen.getByRole('link', { name: 'Support KeyMove' });
  expect(supportLink).toHaveAttribute(
    'href',
    'https://buy.stripe.com/test_cNieVe2GhbdMaeq6sd5os00',
  );
  expect(supportLink).toHaveAttribute('target', '_blank');
  expect(supportLink).toHaveAttribute('rel', 'noreferrer');
  expect(screen.getByRole('link', { name: 'Contact KeyMove Developer' })).toBeInTheDocument();
});

test('records an opening shortcut and rejects conflicts without writing them', async () => {
  render(<PopupSettings />);
  await waitFor(() => expect(storage.get).toHaveBeenCalled());

  fireEvent.click(screen.getByRole('tab', { name: 'Shortcuts' }));
  const shortcut = screen.getByRole('textbox', { name: 'Open KeyMove' });
  expect(shortcut).toHaveValue('Alt+F');
  fireEvent.keyDown(shortcut, { key: 'k', code: 'KeyK', altKey: true });
  expect(storage.set).toHaveBeenCalledWith({
    openingShortcut: {
      code: 'KeyK',
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    },
  });
  storage.set.mockClear();
  fireEvent.keyDown(shortcut, { key: 's', code: 'KeyS', altKey: true });
  expect(screen.getByRole('alert')).toHaveTextContent('already used');
  expect(storage.set).not.toHaveBeenCalled();
});

test('Tooltips mode persists and hides only usage reminders', async () => {
  render(<PopupSettings />);
  await waitFor(() => expect(storage.get).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
  const toggle = screen.getByRole('checkbox', { name: 'Tooltips mode' });
  expect(toggle).toBeChecked();
  fireEvent.click(screen.getByText('Tooltips mode'));
  expect(toggle).not.toBeChecked();
  expect(storage.set).toHaveBeenCalledWith({ tooltipsMode: false });
  expect(screen.queryByText(/focus the searchbar/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Drag the right edge/)).not.toBeInTheDocument();
  expect(screen.getByText(/Show shortcut hints and usage reminders/)).toBeInTheDocument();
});

test('offers nine standard positions and marks the stored one', async () => {
  storage.get.mockResolvedValue({ popupPosition: { x: 0.5, y: 0.75 } });
  render(<PopupSettings />);
  fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));

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
  fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));

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
  fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));

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
  fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
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
