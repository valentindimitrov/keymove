import { browser } from './browser-adapter.js';
import ExtensionMessageTypes from '../src/extension_message_types.js';

it('notifies settings consumers and keeps returned objects isolated from stored values', async () => {
  const listener = vi.fn();
  const initial = await browser.storage.local.get('popupPosition');
  browser.storage.onChanged.addListener(listener);
  await browser.storage.local.set({ popupPosition: { x: 0.2, y: 0.4 } });
  expect(listener).toHaveBeenCalledWith(
    { popupPosition: { oldValue: initial['popupPosition'], newValue: { x: 0.2, y: 0.4 } } },
    'local',
  );
  const data = await browser.storage.local.get('popupPosition');
  (data['popupPosition'] as { x: number }).x = 1;
  expect(await browser.storage.local.get('popupPosition')).toEqual({
    popupPosition: { x: 0.2, y: 0.4 },
  });
  browser.storage.onChanged.removeListener(listener);
  await browser.storage.local.set(initial);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('opens demo settings and explains privileged tab actions without opening a tab', async () => {
  const settings = vi.fn();
  const notice = vi.fn();
  const open = vi.spyOn(window, 'open');
  window.addEventListener('keymove-demo:settings', settings);
  window.addEventListener('keymove-demo:notice', notice);
  await browser.runtime.sendMessage({ type: ExtensionMessageTypes.OPEN_SETTINGS });
  await browser.runtime.sendMessage({
    type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
    url: 'https://example.com/',
    active: false,
  });
  expect(settings).toHaveBeenCalledOnce();
  expect(notice).toHaveBeenCalledWith(
    expect.objectContaining({ detail: expect.stringContaining('installed extension') }),
  );
  expect(open).not.toHaveBeenCalled();
  await expect(
    browser.runtime.sendMessage({ type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB, url: 7 }),
  ).rejects.toThrow('Unsupported demo message');
  window.removeEventListener('keymove-demo:settings', settings);
  window.removeEventListener('keymove-demo:notice', notice);
  open.mockRestore();
});
