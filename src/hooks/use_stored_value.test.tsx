import { act, renderHook } from '@testing-library/react';
import usePopupWidth from './use_popup_width.js';
import useHighlightColors from './use_highlight_colors.js';
import { DEFAULT_POPUP_WIDTH } from '../lib/popup_width_schema.js';

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
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
  storage.get.mockReset().mockResolvedValue({});
  storage.set.mockReset().mockResolvedValue(undefined);
  storage.addListener.mockReset();
  storage.removeListener.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

test('a late width hydration cannot replace a local resize', async () => {
  const read = Promise.withResolvers<Record<string, unknown>>();
  storage.get.mockReturnValue(read.promise);
  const { result } = renderHook(usePopupWidth);
  act(() => result.current.updateWidth(600));
  await act(async () => {
    read.resolve({ popupWidth: 350 });
  });
  expect(result.current.width).toBe(600);
});

test('a rejected latest resize rolls back to the previous width', async () => {
  const write = Promise.withResolvers<void>();
  storage.set.mockReturnValue(write.promise);
  const { result } = renderHook(usePopupWidth);
  await act(async () => {});
  act(() => result.current.updateWidth(600));
  await act(async () => {
    write.reject(new Error('storage unavailable'));
  });
  expect(result.current.width).toBe(DEFAULT_POPUP_WIDTH);
});

test.each(['local', 'external'])(
  'a rejected earlier resize cannot overwrite a newer %s change',
  async source => {
    const write = Promise.withResolvers<void>();
    storage.set.mockReturnValueOnce(write.promise);
    const { result } = renderHook(usePopupWidth);
    await act(async () => {});
    act(() => result.current.updateWidth(600));
    act(() => {
      if (source === 'local') result.current.updateWidth(650);
      else storage.addListener.mock.calls[0]![0]({ popupWidth: { newValue: 650 } }, 'local');
    });
    await act(async () => {
      write.reject(new Error('earlier write failed'));
    });
    expect(result.current.width).toBe(650);
  },
);

test('consecutive colour edits preserve both modes and outrank stale hydration', async () => {
  const read = Promise.withResolvers<Record<string, unknown>>();
  storage.get.mockReturnValue(read.promise);
  const { result, unmount } = renderHook(useHighlightColors);
  act(() => {
    result.current.updateColor('text', '#123456');
    result.current.updateColor('actions', '#abcdef');
  });
  await act(async () => {
    read.resolve({ highlightColors: { text: '#000000', actions: '#ffffff' } });
  });
  expect(result.current.colors).toEqual({ text: '#123456', actions: '#abcdef' });
  expect(storage.set).toHaveBeenLastCalledWith({ highlightColors: result.current.colors });
  unmount();
  expect(storage.removeListener).toHaveBeenCalledWith(storage.addListener.mock.calls[0]![0]);
});

test('storage events validate width and reset removed values', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { result } = renderHook(usePopupWidth);
  await act(async () => {});
  const changed = storage.addListener.mock.calls[0]![0] as (changes: unknown, area: string) => void;
  act(() => changed({ popupWidth: { newValue: 600 } }, 'local'));
  expect(result.current.width).toBe(600);
  act(() => changed({ popupWidth: {} }, 'local'));
  expect(result.current.width).toBe(DEFAULT_POPUP_WIDTH);
  act(() => changed({ popupWidth: 'invalid' }, 'local'));
  expect(result.current.width).toBe(DEFAULT_POPUP_WIDTH);
  expect(warn).toHaveBeenCalled();
});

test('invalid storage containers fall back without accepting unvalidated values', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  storage.get.mockResolvedValue(null);
  const { result } = renderHook(usePopupWidth);
  await act(async () => {});
  expect(result.current.width).toBe(DEFAULT_POPUP_WIDTH);
  expect(warn).toHaveBeenCalled();
});
