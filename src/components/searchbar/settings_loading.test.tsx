import { act, fireEvent, render, within } from '@testing-library/react';
import Searchbar from './searchbar.js';
import createExtensionRoot from '../../lib/create_extension_root.js';
import { makeSearchResult } from '../../test_support/factories.js';

const mocks = vi.hoisted(() => ({ get: vi.fn(), findMatches: vi.fn(), addListener: vi.fn() }));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: { get: mocks.get, set: vi.fn().mockResolvedValue(undefined) },
      onChanged: { addListener: mocks.addListener, removeListener: vi.fn() },
    },
  },
}));
vi.mock('../../hooks/use_extension_messaging.js', () => ({ default: vi.fn() }));
vi.mock('../../hooks/use_highlights.js', () => ({ default: vi.fn() }));
vi.mock('../../lib/find_in_page.js', () => ({
  subscribeToPageChanges: () => () => undefined,
  default: class {
    findMatches() {
      return mocks.findMatches();
    }
  },
}));

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
