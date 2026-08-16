import ExtensionMessageTypes from './extension_message_types.js';
import { isInjectableUrl } from './lib/extension_tabs.js';

const LEGACY_EMAIL_SETTING_KEY = 'userEmail';
const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';
const CONTENT_STYLESHEET_FILE = 'content-scripts/content.css';

export default function registerBackground() {
  if (isManifestV2()) {
    chrome.browserAction.onClicked.addListener(tab => sendBrowserActionClickedMessageToTab(tab));
  } else {
    chrome.action.onClicked.addListener(tab => sendBrowserActionClickedMessageToTab(tab));
  }

  chrome.runtime.onInstalled.addListener(handleInstallationEvent);
}

function handleInstallationEvent(details) {
  chrome.storage.local.remove(LEGACY_EMAIL_SETTING_KEY);

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    injectContentScriptToAllTabs()
  }
}

function sendBrowserActionClickedMessageToTab(tab) {
  if (tab.id && isInjectableUrl(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: ExtensionMessageTypes.BROWSER_ACTION_CLICKED }, () => {
      consumeLastError('send the toolbar action message', tab.id)
    });
  }
}

function injectContentScriptToAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.filter(tab => tab.id && isInjectableUrl(tab.url)).forEach(injectContentScriptToTab)
  });
}

function isManifestV2() {
  const manifestData = chrome.runtime.getManifest();
  return manifestData.manifest_version === 2
}

function injectContentScriptToTab(tab) {
  chrome.tabs.sendMessage(tab.id, { type: ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED }, (msg) => {
    const messageError = chrome.runtime.lastError;
    if (!messageError && msg && msg.status === 'installed') {
      return;
    }

    if (isManifestV2()) {
      injectManifestV2ContentScript(tab.id)
    } else {
      injectManifestV3ContentScript(tab.id)
    }
  });
}

function injectManifestV2ContentScript(tabId) {
  chrome.tabs.executeScript(tabId, { file: CONTENT_SCRIPT_FILE }, () => {
    if (consumeLastError('inject the content script', tabId)) {
      return;
    }

    chrome.tabs.insertCSS(tabId, { file: CONTENT_STYLESHEET_FILE }, () => {
      consumeLastError('inject the stylesheet', tabId)
    });
  });
}

function injectManifestV3ContentScript(tabId) {
  chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] }, () => {
    if (consumeLastError('inject the content script', tabId)) {
      return;
    }

    chrome.scripting.insertCSS({ target: { tabId }, files: [CONTENT_STYLESHEET_FILE] }, () => {
      consumeLastError('inject the stylesheet', tabId)
    });
  });
}

function consumeLastError(operation, tabId) {
  const error = chrome.runtime.lastError;
  if (!error) {
    return false;
  }

  console.debug(`YipYip could not ${operation} in tab ${tabId}: ${error.message}`)
  return true;
}
