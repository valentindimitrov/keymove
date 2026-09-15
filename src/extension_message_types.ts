import { isRecord } from './lib/runtime_schema.js';

const ExtensionMessageTypes = {
  OPEN_SETTINGS: 'KEYMOVE_OPEN_SETTINGS',
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
  | { type: typeof ExtensionMessageTypes.OPEN_SETTINGS }
  | { type: typeof ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED }
  | OpenLinkInNewTabMessage;

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!isRecord(value) || !Object.hasOwn(value, 'type')) {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (message['type'] === ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB) {
    return (
      Object.hasOwn(message, 'url') &&
      Object.hasOwn(message, 'active') &&
      typeof message['url'] === 'string' &&
      typeof message['active'] === 'boolean'
    );
  }
  return (
    message['type'] === ExtensionMessageTypes.CONTENT_SCRIPT_INSTALLED ||
    message['type'] === ExtensionMessageTypes.OPEN_SETTINGS
  );
}

export type { ExtensionMessage, ExtensionMessageType, OpenLinkInNewTabMessage };
export { isExtensionMessage };
export default ExtensionMessageTypes;
