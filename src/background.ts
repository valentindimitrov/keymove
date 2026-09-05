import ExtensionMessageTypes, { isExtensionMessage } from './extension_message_types.js';
import { EXTENSION_NAME } from './extension_identity.js';
import { isInjectableUrl, normalizedOpenableLinkUrl } from './lib/extension_tabs.js';
import { browser, type Browser } from 'wxt/browser';

const CONTENT_SCRIPT_FILE = '/content-scripts/content.js';
const CONTENT_STYLESHEET_FILE = 'content-scripts/content.css';

export default function registerBackground() {
  browser.action.onClicked.addListener(tab => {
    void sendToolbarActionClickedMessageToTab(tab);
  });

  browser.runtime.onInstalled.addListener(handleInstallationEvent);
  browser.runtime.onMessage.addListener((message, sender) => {
    void handleExtensionMessage(message, sender);
  });
}

async function handleExtensionMessage(message: unknown, sender: Browser.runtime.MessageSender) {
  if (!isExtensionMessage(message) || message.type !== ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB) {
    return;
  }

  if (!sender.tab) {
    reportExtensionApiError(
      'open a link requested outside a content-script tab',
      new Error('missing sender tab'),
    );
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

async function sendToolbarActionClickedMessageToTab(tab: Browser.tabs.Tab) {
  if (tab.id !== undefined && isInjectableUrl(tab.url)) {
    try {
      await browser.tabs.sendMessage(tab.id, {
        type: ExtensionMessageTypes.TOOLBAR_ACTION_CLICKED,
      });
    } catch (error) {
      reportExtensionApiError('send the toolbar action message', error, tab.id);
    }
  }
}

async function injectContentScriptToAllTabs() {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs
      .filter(tab => tab.id !== undefined && isInjectableUrl(tab.url))
      .map(tab => injectContentScriptToTab(tab)),
  );
}

async function injectContentScriptToTab(tab: Browser.tabs.Tab) {
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
  return Boolean(
    value && typeof value === 'object' && 'status' in value && value.status === 'installed',
  );
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
