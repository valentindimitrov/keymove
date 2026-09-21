import { act, fireEvent, render, within } from '@testing-library/react';
import Searchbar from './searchbar.js';
import createExtensionRoot from '../../lib/create_extension_root.js';
import { makeSearchResult } from '../../test_support/factories.js';
import ExtensionMessageTypes from '../../extension_message_types.js';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  findMatches: vi.fn(),
  addListener: vi.fn(),
  messages: new Set<
    (
      message: unknown,
      sender: { id: string; url: string },
      respond: (value: unknown) => void,
    ) => void
  >(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'keymove-test',
      getURL: () => 'chrome-extension://keymove-test/popup.html',
      onMessage: {
        addListener: (listener: Parameters<typeof mocks.messages.add>[0]) =>
          mocks.messages.add(listener),
        removeListener: (listener: Parameters<typeof mocks.messages.delete>[0]) =>
          mocks.messages.delete(listener),
      },
    },
    storage: {
      local: { get: mocks.get, set: vi.fn().mockResolvedValue(undefined) },
      onChanged: { addListener: mocks.addListener, removeListener: vi.fn() },
    },
  },
}));
vi.mock('../../hooks/use_highlights.js', () => ({ default: vi.fn() }));
vi.mock('../../lib/find_in_page.js', () => ({
  subscribeToPageChanges: () => () => undefined,
  default: class {
    findMatches() {
      return mocks.findMatches();
    }
  },
}));

test('settings requests reveal and focus only after hydration, respect pause and validate the sender', async () => {
  const read = Promise.withResolvers<Record<string, unknown>>();
  mocks.get.mockReturnValue(read.promise);
  mocks.addListener.mockClear();
  mocks.findMatches.mockResolvedValue(makeSearchResult());
  const root = createExtensionRoot('')!;
  const view = render(<Searchbar />, { container: root.app });
  const input = within(root.app).getByRole('combobox', { name: 'Search page', hidden: true });
  const sender = { id: 'keymove-test', url: 'chrome-extension://keymove-test/popup.html' };
  const respond = vi.fn();
  const send = (
    source = sender,
    message: unknown = { type: ExtensionMessageTypes.SHOW_SEARCHBAR },
  ) => {
    respond.mockClear();
    act(() => {
      for (const listener of mocks.messages) listener(message, source, respond);
    });
  };
  try {
    send();
    expect(respond).toHaveBeenCalledWith({ status: 'loading' });
    expect(root.shadowRoot.activeElement).not.toBe(input);
    await act(async () => read.resolve({ alwaysOn: false, autoHide: true }));
    send({ ...sender, id: 'other-extension' });
    expect(respond).not.toHaveBeenCalled();
    send({ ...sender, url: 'https://example.com' });
    expect(respond).not.toHaveBeenCalled();
    send(sender, Object.create({ type: ExtensionMessageTypes.SHOW_SEARCHBAR }));
    expect(respond).not.toHaveBeenCalled();
    expect(root.shadowRoot.activeElement).not.toBe(input);
    send();
    expect(respond).toHaveBeenCalledWith({ status: 'shown' });
    expect(root.shadowRoot.activeElement).toBe(input);
    await act(async () => {
      for (const [listener] of mocks.addListener.mock.calls)
        listener({ [`siteBehavior:${location.hostname}`]: { newValue: 'paused' } }, 'local');
    });
    send();
    expect(respond).toHaveBeenCalledWith({ status: 'paused' });
    expect(root.shadowRoot.activeElement).not.toBe(input);
  } finally {
    view.unmount();
    root.host.remove();
  }
  expect(mocks.messages.size).toBe(0);
});

test.each([false, true, undefined])(
  'leaves page typing alone while storage loads, then honors alwaysOn=%s',
  async savedValue => {
    const read = Promise.withResolvers<Record<string, boolean>>();
    mocks.get.mockReturnValue(read.promise);
    mocks.findMatches.mockResolvedValue(makeSearchResult());
    const root = createExtensionRoot('')!;
    const view = render(<Searchbar />, { container: root.app });
    const input = within(root.app).getByRole('combobox', { name: 'Search page', hidden: true });
    try {
      expect(fireEvent.keyDown(document.body, { key: 'a', code: 'KeyA' })).toBe(true);
      expect(input).toHaveValue('');
      expect(root.shadowRoot.activeElement).not.toBe(input);

      // Wait for saved pause and shortcut rules before intercepting anything.
      fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF', altKey: true });
      expect(root.shadowRoot.activeElement).not.toBe(input);
      fireEvent.keyDown(input, { key: 'Escape', code: 'Escape', composed: true });

      await act(async () => read.resolve(savedValue === undefined ? {} : { alwaysOn: savedValue }));
      const enabled = savedValue ?? true;
      expect(fireEvent.keyDown(document.body, { key: 'b', code: 'KeyB' })).toBe(!enabled);
      expect(input).toHaveValue(enabled ? 'b' : '');
      await act(async () => {});
    } finally {
      view.unmount();
      root.host.remove();
    }
  },
);

test('site pause releases keys, cancels the query and can be resumed live with a remapped shortcut', async () => {
  mocks.addListener.mockClear();
  mocks.get.mockResolvedValue({
    autoHide: false,
    alwaysOn: true,
    openingShortcut: {
      code: 'KeyK',
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    },
    [`siteBehavior:${location.hostname}`]: 'shortcut',
  });
  mocks.findMatches.mockResolvedValue(makeSearchResult());
  const root = createExtensionRoot('')!;
  const view = render(<Searchbar />, { container: root.app });
  const input = within(root.app).getByRole('combobox', { name: 'Search page', hidden: true });
  const emit = async (value: unknown) =>
    act(async () => {
      for (const [listener] of mocks.addListener.mock.calls)
        listener({ [`siteBehavior:${location.hostname}`]: { newValue: value } }, 'local');
    });
  try {
    await act(async () => {});
    expect(root.shadowRoot.activeElement).not.toBe(input);
    for (const init of [
      { key: 'g', code: 'KeyG' },
      { key: 'f', code: 'KeyF', altKey: true },
      { key: 'Tab', code: 'Tab' },
      { key: 'Enter', code: 'Enter' },
    ])
      expect(fireEvent.keyDown(document.body, init)).toBe(true);
    expect(input).toHaveValue('');
    expect(fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', altKey: true })).toBe(false);
    expect(root.shadowRoot.activeElement).toBe(input);
    fireEvent.input(input, { target: { value: 'test' } });
    await act(async () => {});
    await emit('paused');
    expect(input).toHaveValue('');
    expect(root.shadowRoot.activeElement).not.toBe(input);
    expect(fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', altKey: true })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' })).toBe(true);
    await emit(undefined);
    expect(fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' })).toBe(false);
    expect(input).toHaveValue('t');
    await act(async () => {});
  } finally {
    view.unmount();
    root.host.remove();
  }
});
