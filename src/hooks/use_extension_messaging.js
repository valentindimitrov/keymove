import React from 'react';
import ExtensionMessageTypes from '../extension_message_types.js';

const useExtensionMessaging = ({ handleToolbarActionClicked }) => {
  const handleExtensionMessage = React.useCallback(
    (message, sender, sendResponse) => {
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
    chrome.runtime.onMessage.addListener(handleExtensionMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleExtensionMessage);
    };
  }, [handleExtensionMessage]);
};

export default useExtensionMessaging;
