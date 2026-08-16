import React from 'react';
import ExtensionMessageTypes from '../extension_message_types.js';
import { isExtensionMessage } from '../extension_message_types.js';
import { browser, type Browser } from 'wxt/browser';

type ExtensionMessagingOptions = { handleToolbarActionClicked: () => void };

const useExtensionMessaging = ({ handleToolbarActionClicked }: ExtensionMessagingOptions) => {
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
        case ExtensionMessageTypes.TOOLBAR_ACTION_CLICKED:
          handleToolbarActionClicked();
          break;
        case ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED:
          sendResponse({ status: 'installed' });
          break;
        default:
          break;
      }
    },
    [handleToolbarActionClicked],
  );

  React.useEffect(() => {
    browser.runtime.onMessage.addListener(handleExtensionMessage);
    return () => {
      browser.runtime.onMessage.removeListener(handleExtensionMessage);
    };
  }, [handleExtensionMessage]);
};

export default useExtensionMessaging;
