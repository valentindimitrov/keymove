import { waitFor } from '@testing-library/react';
import type { Browser } from 'wxt/browser';
import ExtensionMessageTypes from './extension_message_types.js';
import { EXTENSION_NAME } from './extension_identity.js';
import registerBackground, {
  handleExtensionMessage,
  handleInstallationEvent,
} from './background.js';

const browserMocks = vi.hoisted(() => ({
  query: vi.fn(),
  create: vi.fn(),
  sendMessage: vi.fn(),
  executeScript: vi.fn(),
  insertCSS: vi.fn(),
  onMessage: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      query: browserMocks.query,
      create: browserMocks.create,
      sendMessage: browserMocks.sendMessage,
    },
    scripting: { executeScript: browserMocks.executeScript, insertCSS: browserMocks.insertCSS },
    action: { onClicked: { addListener: vi.fn() } },
    runtime: {
      id: 'keymove-test',
      onMessage: { addListener: browserMocks.onMessage },
      onInstalled: { addListener: vi.fn() },
    },
  },
}));

beforeEach(() => {
  browserMocks.query.mockReset().mockResolvedValue([]);
  browserMocks.create.mockReset().mockResolvedValue(undefined);
  browserMocks.sendMessage.mockReset().mockResolvedValue({ status: 'installed' });
  browserMocks.executeScript.mockReset().mockResolvedValue([]);
  browserMocks.insertCSS.mockReset().mockResolvedValue(undefined);
  browserMocks.onMessage.mockReset();
});

const tabSender = { id: 'keymove-test', frameId: 0, tab: { id: 42 } as Browser.tabs.Tab };

test.each([
  { active: true, description: 'foreground' },
  { active: false, description: 'background' },
])('opens a validated link in a $description tab', async ({ active }) => {
  await handleExtensionMessage(
    {
      type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
      url: 'https://example.com/path',
      active,
    },
    tabSender,
  );

  expect(browserMocks.create).toHaveBeenCalledWith({
    url: 'https://example.com/path',
    active,
  });
});

test('rejects malformed or unsafe new-tab messages', async () => {
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  await handleExtensionMessage(
    {
      type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
      url: 'javascript:alert(1)',
      active: false,
    },
    tabSender,
  );
  await handleExtensionMessage(
    {
      type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
      url: 'https://example.com',
      active: 'yes',
    },
    tabSender,
  );

  expect(browserMocks.create).not.toHaveBeenCalled();
  expect(debugSpy).toHaveBeenCalledOnce();
  debugSpy.mockRestore();
});

test('rejects a new-tab request without a content-script sender tab', async () => {
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  await handleExtensionMessage(
    {
      type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
      url: 'https://example.com/path',
      active: false,
    },
    {},
  );

  expect(browserMocks.create).not.toHaveBeenCalled();
  expect(debugSpy).toHaveBeenCalledWith(
    `${EXTENSION_NAME} could not open a link requested by an invalid sender: expected this extension in a top-level content-script tab`,
  );
  debugSpy.mockRestore();
});

test.each([
  { ...tabSender, id: 'another-extension' },
  { ...tabSender, frameId: 1 },
  { ...tabSender, tab: { id: -1 } as Browser.tabs.Tab },
])('rejects a new-tab request from an unexpected sender: %j', async sender => {
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  await handleExtensionMessage(
    { type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB, url: 'https://example.com', active: true },
    sender,
  );
  expect(browserMocks.create).not.toHaveBeenCalled();
  debug.mockRestore();
});

test('keeps the message channel open until the tab request finishes', async () => {
  const created = Promise.withResolvers<void>();
  browserMocks.create.mockReturnValue(created.promise);
  registerBackground();
  const listener = browserMocks.onMessage.mock.calls[0]![0] as (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    respond: () => void,
  ) => boolean | undefined;
  const respond = vi.fn();
  expect(
    listener({ type: ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED }, tabSender, respond),
  ).toBeUndefined();
  expect(
    listener(
      {
        type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
        url: 'https://example.com',
        active: true,
      },
      tabSender,
      respond,
    ),
  ).toBe(true);
  expect(respond).not.toHaveBeenCalled();
  created.resolve();
  await waitFor(() => expect(respond).toHaveBeenCalledOnce());
});

test('limits concurrent installation probes and eventually visits every eligible tab', async () => {
  browserMocks.query.mockResolvedValue(
    Array.from({ length: 12 }, (_, id) => ({ id, url: 'https://example.com' })),
  );
  const firstBatch = Promise.withResolvers<unknown>();
  browserMocks.sendMessage.mockReturnValue(firstBatch.promise);
  handleInstallationEvent({ reason: 'install' });
  await waitFor(() => expect(browserMocks.sendMessage).toHaveBeenCalledTimes(4));
  firstBatch.resolve({ status: 'installed' });
  await waitFor(() => expect(browserMocks.sendMessage).toHaveBeenCalledTimes(12));
  expect(browserMocks.executeScript).not.toHaveBeenCalled();
});

test('ignores malformed tab records returned during installation', async () => {
  browserMocks.query.mockResolvedValue([
    null,
    [],
    { id: '42', url: 'https://example.com' },
    { id: -1, url: 'https://example.com' },
    { id: 3, url: 'chrome://settings' },
    { id: 4, url: 'https://example.com' },
  ]);
  handleInstallationEvent({ reason: 'install' });
  await waitFor(() => expect(browserMocks.sendMessage).toHaveBeenCalledOnce());
  expect(browserMocks.sendMessage).toHaveBeenCalledWith(4, {
    type: ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED,
  });
});

test('reports a tab-query failure while installing into existing tabs', async () => {
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  browserMocks.query.mockRejectedValueOnce(new Error('tabs unavailable'));
  const details: Browser.runtime.InstalledDetails = { reason: 'install' };

  handleInstallationEvent(details);

  await waitFor(() =>
    expect(debugSpy).toHaveBeenCalledWith(
      `${EXTENSION_NAME} could not query tabs during installation: tabs unavailable`,
    ),
  );
  debugSpy.mockRestore();
});
