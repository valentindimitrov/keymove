const ExtensionMessageTypes = {
  TOOLBAR_ACTION_CLICKED: 'YIPYIP_TOOLBAR_ACTION_CLICKED',
  CONTENT_SCRIPT_INSTALLED: 'YIPYIP_CONTENT_SCRIPT_INSTALLED',
} as const;

type ExtensionMessageType = (typeof ExtensionMessageTypes)[keyof typeof ExtensionMessageTypes];
type ExtensionMessage = { type: ExtensionMessageType };

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false;
  }
  return Object.values(ExtensionMessageTypes).includes(
    (value as { type: ExtensionMessageType }).type,
  );
}

export type { ExtensionMessage, ExtensionMessageType };
export { isExtensionMessage };
export default ExtensionMessageTypes;
