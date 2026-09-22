import { browser, type Browser } from 'wxt/browser';
import {
  FRAME_MESSAGE,
  isFrameEnvelope,
  isFrameId,
  isFrameRequest,
  isFrameToken,
} from './lib/frame_protocol.js';
import {
  parseOpeningShortcut,
  parseSiteBehavior,
  siteHostname,
} from './lib/interaction_settings_schema.js';

// Only extension content scripts may relay within their own tab. No page postMessage
// payload can request search results or an action; discovery carries an opaque nonce only.
export function registerFrameRelay() {
  const listener = (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    respond: (value: unknown) => void,
  ) => {
    if (
      !isFrameEnvelope(message) ||
      sender.id !== browser.runtime.id ||
      !isFrameId(sender.tab?.id) ||
      !isFrameId(sender.frameId)
    )
      return;
    const tabId = sender.tab.id;
    let task: Promise<unknown> | undefined;
    if (message.kind === 'configuration') {
      const hostname = siteHostname(sender.tab.url ?? '');
      task = browser.storage.local
        .get(['openingShortcut', 'alwaysOn', `siteBehavior:${hostname}`])
        .then(settings => ({
          shortcut: parseOpeningShortcut(settings.openingShortcut),
          behavior:
            parseSiteBehavior(settings[`siteBehavior:${hostname}`]) ??
            (settings.alwaysOn === false ? 'shortcut' : 'type'),
        }));
    } else if (message.kind === 'hello' && isFrameToken(message.token)) {
      task = browser.tabs.sendMessage(tabId, {
        type: FRAME_MESSAGE,
        kind: 'ready',
        token: message.token,
        frameId: sender.frameId,
      });
    } else if (
      message.kind === 'request' &&
      isFrameId(message.frameId) &&
      message.frameId !== sender.frameId &&
      isFrameRequest(message.request)
    ) {
      task = browser.tabs.sendMessage(
        tabId,
        {
          type: FRAME_MESSAGE,
          kind: 'deliver',
          requester: sender.frameId,
          request: message.request,
        },
        { frameId: message.frameId },
      );
    } else if (message.kind === 'changed' && isFrameId(message.frameId)) {
      task = browser.tabs.sendMessage(
        tabId,
        { type: FRAME_MESSAGE, kind: 'changed', source: sender.frameId },
        { frameId: message.frameId },
      );
    } else if (message.kind === 'open' && sender.frameId !== 0) {
      task = browser.tabs.sendMessage(
        tabId,
        {
          type: FRAME_MESSAGE,
          kind: 'open',
          text:
            typeof message.text === 'string' && Array.from(message.text).length === 1
              ? message.text
              : '',
        },
        { frameId: 0 },
      );
    }
    if (!task) return;
    void task.then(respond, () => respond(null));
    return true;
  };
  browser.runtime.onMessage.addListener(listener);
}
