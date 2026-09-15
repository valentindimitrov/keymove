import { act, fireEvent, render, within } from '@testing-library/react';
import Searchbar from './searchbar.js';
import createExtensionRoot from '../../lib/create_extension_root.js';
import { makeSearchResult } from '../../test_support/factories.js';

const mocks = vi.hoisted(() => ({ get: vi.fn(), findMatches: vi.fn() }));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: { get: mocks.get, set: vi.fn().mockResolvedValue(undefined) },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
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

      // Explicit activation is available even before storage responds.
      fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF', altKey: true });
      expect(root.shadowRoot.activeElement).toBe(input);
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
