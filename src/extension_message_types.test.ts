// @vitest-environment node
import ExtensionMessageTypes, { isExtensionMessage } from './extension_message_types.js';

test('rejects arrays and inherited message fields', () => {
  const message = {
    type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
    url: 'https://example.com',
    active: true,
  };
  expect(isExtensionMessage(message)).toBe(true);
  expect(isExtensionMessage(Object.assign([], message))).toBe(false);
  expect(isExtensionMessage(Object.create(message))).toBe(false);
  expect(
    isExtensionMessage(
      Object.assign(Object.create({ url: message.url, active: true }), { type: message.type }),
    ),
  ).toBe(false);
});
