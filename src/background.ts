import ExtensionMessageTypes from './extension_message_types.js';
import { isInjectableUrl } from './lib/extension_tabs.js';
import { browser, type Browser } from 'wxt/browser';

// One-release migration for users upgrading from authentication-enabled builds.
// Remove this after version 1.3.1 has been broadly distributed.
const LEGACY_EMAIL_SETTING_KEY = 'userEmail';
const CONTENT_SCRIPT_FILE = '/content-scripts/content.js';
const CONTENT_STYLESHEET_FILE = 'content-scripts/content.css';

export default function registerBackground() {
  browser.action.onClicked.addListener(tab => {
    void sendToolbarActionClickedMessageToTab(tab);
  });

  browser.runtime.onInstalled.addListener(handleInstallationEvent);
}

function handleInstallationEvent(details: Browser.runtime.InstalledDetails) {
  void browser.storage.local
    .remove(LEGACY_EMAIL_SETTING_KEY)
    .catch(error => reportExtensionApiError('remove the legacy email setting', error));

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
  console.debug(`YipYip could not ${operation}${tabContext}: ${message}`);
}

export { handleInstallationEvent };
