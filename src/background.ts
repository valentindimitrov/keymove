import ExtensionMessageTypes, { isExtensionMessage } from './extension_message_types.js';
import { EXTENSION_NAME } from './extension_identity.js';
import { isInjectableUrl, normalizedOpenableLinkUrl } from './lib/extension_tabs.js';
import { isRecord } from './lib/runtime_schema.js';
import { browser, type Browser } from 'wxt/browser';

const CONTENT_SCRIPT_FILE = '/content-scripts/content.js';
const CONTENT_STYLESHEET_FILE = 'content-scripts/content.css';
const INSTALLATION_CONCURRENCY = 4;

export default function registerBackground() {
  browser.runtime.onInstalled.addListener(handleInstallationEvent);
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      !isExtensionMessage(message) ||
      message.type === ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED
    )
      return undefined;
    void handleExtensionMessage(message, sender).then(() => sendResponse());
    return true;
  });
}

async function handleExtensionMessage(message: unknown, sender: Browser.runtime.MessageSender) {
  if (
    !isExtensionMessage(message) ||
    message.type === ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED
  ) {
    return;
  }

  if (
    !sender.tab ||
    !Number.isInteger(sender.tab.id) ||
    (sender.tab.id ?? -1) < 0 ||
    sender.id !== browser.runtime.id ||
    sender.frameId !== 0
  ) {
    reportExtensionApiError(
      'open a link requested by an invalid sender',
      new Error('expected this extension in a top-level content-script tab'),
    );
    return;
  }

  if (message.type === ExtensionMessageTypes.OPEN_SETTINGS) {
    try {
      await browser.action.openPopup();
    } catch {
      // Older browsers may disallow opening the toolbar popup from a content-script request.
      try {
        await browser.tabs.create({
          url: browser.runtime.getURL('/popup.html'),
          active: true,
          openerTabId: sender.tab.id,
        });
      } catch (error) {
        reportExtensionApiError('open settings', error);
      }
    }
    return;
  }

  const url = normalizedOpenableLinkUrl(message.url);
  if (!url) {
    reportExtensionApiError('open an invalid link in a new tab', new Error('unsupported URL'));
    return;
  }

  try {
    await browser.tabs.create({ url, active: message.active });
  } catch (error) {
    reportExtensionApiError('open the link in a new tab', error);
  }
}

function handleInstallationEvent(details: Browser.runtime.InstalledDetails) {
  if (details.reason === 'install') {
    void injectContentScriptToAllTabs().catch(error =>
      reportExtensionApiError('query tabs during installation', error),
    );
  }
}

async function injectContentScriptToAllTabs() {
  const response: unknown = await browser.tabs.query({});
  if (!Array.isArray(response)) throw new TypeError('tabs query must return an array');
  const tabs = response.filter(
    (tab): tab is { id: number; url: string } =>
      isRecord(tab) &&
      typeof tab['id'] === 'number' &&
      Number.isInteger(tab['id']) &&
      tab['id'] >= 0 &&
      typeof tab['url'] === 'string' &&
      isInjectableUrl(tab['url']),
  );
  let nextTab = 0;
  await Promise.all(
    Array.from({ length: Math.min(INSTALLATION_CONCURRENCY, tabs.length) }, async () => {
      while (nextTab < tabs.length) {
        const tab = tabs[nextTab++]!;
        await injectContentScriptToTab(tab);
      }
    }),
  );
}

async function injectContentScriptToTab(tab: { id: number }) {
  if (tab.id === undefined) {
    return;
  }

  try {
    const response: unknown = await browser.tabs.sendMessage(tab.id, {
      type: ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED,
    });
    if (isInstalledResponse(response)) {
      return;
    }
  } catch {
    // A missing receiver means the content script still needs to be injected.
  }

  await injectContentScriptAndStyles(tab.id);
}

function isInstalledResponse(value: unknown): value is { status: 'installed' } {
  return isRecord(value) && Object.hasOwn(value, 'status') && value['status'] === 'installed';
}

async function injectContentScriptAndStyles(tabId: number) {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
    });
    await browser.scripting.insertCSS({
      target: { tabId },
      files: [CONTENT_STYLESHEET_FILE],
    });
  } catch (error) {
    reportExtensionApiError('inject the content script and stylesheet', error, tabId);
  }
}

function reportExtensionApiError(operation: string, error: unknown, tabId?: number) {
  const message = error instanceof Error ? error.message : String(error);
  const tabContext = tabId === undefined ? '' : ` in tab ${tabId}`;
  console.debug(`${EXTENSION_NAME} could not ${operation}${tabContext}: ${message}`);
}

export { handleExtensionMessage, handleInstallationEvent };
