import React from 'react';
import ExtensionMessageTypes from '../extension_message_types.js';
import { isExtensionMessage } from '../extension_message_types.js';
import { browser, type Browser } from 'wxt/browser';

const useExtensionMessaging = (showSearchbar?: () => 'shown' | 'paused' | 'loading') => {
  const handleExtensionMessage = React.useCallback(
    (
      message: unknown,
      sender: Browser.runtime.MessageSender,
      sendResponse: (value: unknown) => void,
    ) => {
      if (!isExtensionMessage(message)) {
        return;
      }
      switch (message.type) {
        case ExtensionMessageTypes.SHOW_SEARCHBAR:
          // Only our settings document may request focus, never host-page content.
          if (
            sender.id === browser.runtime.id &&
            sender.url === browser.runtime.getURL('/popup.html')
          ) {
            sendResponse({ status: showSearchbar?.() ?? 'loading' });
          }
          break;
        case ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED:
          sendResponse({ status: 'installed' });
          break;
        default:
          break;
      }
    },
    [showSearchbar],
  );

  React.useEffect(() => {
    browser.runtime.onMessage.addListener(handleExtensionMessage);
    return () => {
      browser.runtime?.onMessage.removeListener(handleExtensionMessage);
    };
  }, [handleExtensionMessage]);
};

export default useExtensionMessaging;
