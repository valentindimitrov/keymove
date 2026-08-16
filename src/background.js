import ExtensionMessageTypes from './extension_message_types.js';
import { isInjectableUrl } from './lib/extension_tabs.js';

const LEGACY_EMAIL_SETTING_KEY = 'userEmail';
const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';
const CONTENT_STYLESHEET_FILE = 'content-scripts/content.css';

export default function registerBackground() {
  chrome.action.onClicked.addListener(tab => sendToolbarActionClickedMessageToTab(tab));

  chrome.runtime.onInstalled.addListener(handleInstallationEvent);
}

function handleInstallationEvent(details) {
  chrome.storage.local.remove(LEGACY_EMAIL_SETTING_KEY);

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    injectContentScriptToAllTabs();
  }
}

function sendToolbarActionClickedMessageToTab(tab) {
  if (tab.id && isInjectableUrl(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: ExtensionMessageTypes.TOOLBAR_ACTION_CLICKED }, () => {
      consumeLastError('send the toolbar action message', tab.id);
    });
  }
}

function injectContentScriptToAllTabs() {
  chrome.tabs.query({}, tabs => {
    tabs.filter(tab => tab.id && isInjectableUrl(tab.url)).forEach(injectContentScriptToTab);
  });
}

function injectContentScriptToTab(tab) {
  chrome.tabs.sendMessage(tab.id, { type: ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED }, msg => {
    const messageError = chrome.runtime.lastError;
    if (!messageError && msg && msg.status === 'installed') {
      return;
    }

    injectContentScriptAndStyles(tab.id);
  });
}

function injectContentScriptAndStyles(tabId) {
  chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] }, () => {
    if (consumeLastError('inject the content script', tabId)) {
      return;
    }

    chrome.scripting.insertCSS({ target: { tabId }, files: [CONTENT_STYLESHEET_FILE] }, () => {
      consumeLastError('inject the stylesheet', tabId);
    });
  });
}

function consumeLastError(operation, tabId) {
  const error = chrome.runtime.lastError;
  if (!error) {
    return false;
  }

  console.debug(`YipYip could not ${operation} in tab ${tabId}: ${error.message}`);
  return true;
}
