import React from 'react';
import ExtensionMessageTypes from '../extension_message_types.js';
import { isExtensionMessage } from '../extension_message_types.js';
import { browser, type Browser } from 'wxt/browser';

const useExtensionMessaging = () => {
  const handleExtensionMessage = React.useCallback(
    (
      message: unknown,
      _sender: Browser.runtime.MessageSender,
      sendResponse: (value: unknown) => void,
    ) => {
      if (!isExtensionMessage(message)) {
        return;
      }
      switch (message.type) {
        case ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED:
          sendResponse({ status: 'installed' });
          break;
        default:
          break;
      }
    },
    [],
  );

  React.useEffect(() => {
    browser.runtime.onMessage.addListener(handleExtensionMessage);
    return () => {
      browser.runtime.onMessage.removeListener(handleExtensionMessage);
    };
  }, [handleExtensionMessage]);
};

export default useExtensionMessaging;
