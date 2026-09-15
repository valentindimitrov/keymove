import { act, renderHook } from '@testing-library/react';
import useExtensionMessaging from './use_extension_messaging.js';
import useStoredSettings from './use_stored_settings.js';
import usePopupPosition from './use_popup_position.js';
import usePopupWidth from './use_popup_width.js';
import useHighlightColors from './use_highlight_colors.js';

const mocks = vi.hoisted(() => {
  const event = { addListener: vi.fn(), removeListener: vi.fn() };
  const runtime = { onMessage: event };
  const storage = {
    onChanged: event,
    local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
  };
  const browser: { runtime: typeof runtime | undefined; storage: typeof storage | undefined } = {
    runtime,
    storage,
  };
  return { browser, runtime, storage, event };
});

vi.mock('wxt/browser', () => ({ browser: mocks.browser }));

beforeEach(() => {
  mocks.browser.runtime = mocks.runtime;
  mocks.browser.storage = mocks.storage;
  mocks.event.addListener.mockClear();
  mocks.event.removeListener.mockClear();
});

afterEach(() => {
  mocks.browser.runtime = mocks.runtime;
  mocks.browser.storage = mocks.storage;
});

describe.each([
  ['messaging', useExtensionMessaging],
  ['settings', useStoredSettings],
  ['position', usePopupPosition],
  ['width', usePopupWidth],
  ['colours', useHighlightColors],
] as const)('%s cleanup', (_name, useHook) => {
  test('unmounts after extension reload removes the browser APIs', async () => {
    const { unmount } = renderHook(() => {
      useHook();
    });
    await act(async () => {});
    expect(mocks.event.addListener).toHaveBeenCalledOnce();
    mocks.browser.runtime = undefined;
    mocks.browser.storage = undefined;
    expect(() => unmount()).not.toThrow();
  });

  test('still removes its listener during a normal unmount', async () => {
    const { unmount } = renderHook(() => {
      useHook();
    });
    await act(async () => {});
    const listener = mocks.event.addListener.mock.calls[0]![0];
    unmount();
    expect(mocks.event.removeListener).toHaveBeenCalledExactlyOnceWith(listener);
  });
});
