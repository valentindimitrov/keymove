import { waitFor } from '@testing-library/react';
import type { Browser } from 'wxt/browser';
import ExtensionMessageTypes from './extension_message_types.js';
import { EXTENSION_NAME } from './extension_identity.js';
import { handleExtensionMessage, handleInstallationEvent } from './background.js';

const browserMocks = vi.hoisted(() => ({
  query: vi.fn(),
  create: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: { query: browserMocks.query, create: browserMocks.create },
  },
}));

beforeEach(() => {
  browserMocks.query.mockReset().mockResolvedValue([]);
  browserMocks.create.mockReset().mockResolvedValue(undefined);
});

const tabSender = { tab: { id: 42 } as Browser.tabs.Tab };

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
    `${EXTENSION_NAME} could not open a link requested outside a content-script tab: missing sender tab`,
  );
  debugSpy.mockRestore();
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
