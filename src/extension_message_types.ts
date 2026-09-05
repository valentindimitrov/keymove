const ExtensionMessageTypes = {
  TOOLBAR_ACTION_CLICKED: 'KEYMOVE_TOOLBAR_ACTION_CLICKED',
  CONTENT_SCRIPT_INSTALLED: 'KEYMOVE_CONTENT_SCRIPT_INSTALLED',
  OPEN_LINK_IN_NEW_TAB: 'KEYMOVE_OPEN_LINK_IN_NEW_TAB',
} as const;

type ExtensionMessageType = (typeof ExtensionMessageTypes)[keyof typeof ExtensionMessageTypes];
type OpenLinkInNewTabMessage = {
  type: typeof ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB;
  url: string;
  active: boolean;
};
type ExtensionMessage =
  | {
      type:
        | typeof ExtensionMessageTypes.TOOLBAR_ACTION_CLICKED
        | typeof ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED;
    }
  | OpenLinkInNewTabMessage;

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (message['type'] === ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB) {
    return typeof message['url'] === 'string' && typeof message['active'] === 'boolean';
  }
  return (
    message['type'] === ExtensionMessageTypes.TOOLBAR_ACTION_CLICKED ||
    message['type'] === ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED
  );
}

export type { ExtensionMessage, ExtensionMessageType, OpenLinkInNewTabMessage };
export { isExtensionMessage };
export default ExtensionMessageTypes;
