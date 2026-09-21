import ExtensionMessageTypes, { isExtensionMessage } from '../src/extension_message_types.js';
import { DEFAULT_STORED_SETTINGS } from '../src/lib/stored_settings_schema.js';

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Listener = (changes: Changes, area: 'local') => void;
const listeners = new Set<Listener>();
// Deliberately session-only: trying the website must not change extension preferences.
const values: Record<string, unknown> = {
  ...DEFAULT_STORED_SETTINGS,
  autoHide: false,
  alwaysOn: false,
  popupPosition: { x: 0.5, y: 0.64 },
  popupWidth: 510,
};

export function notifyDemo(message: string) {
  window.dispatchEvent(new CustomEvent('keymove-demo:notice', { detail: message }));
}

export const browser = {
  storage: {
    local: {
      async get(keys: string | string[]) {
        return Object.fromEntries(
          (typeof keys === 'string' ? [keys] : keys)
            .filter(key => Object.hasOwn(values, key))
            .map(key => [key, structuredClone(values[key])]),
        );
      },
      async set(updates: Record<string, unknown>) {
        const changes: Changes = {};
        for (const [key, value] of Object.entries(updates)) {
          changes[key] = {
            oldValue: structuredClone(values[key]),
            newValue: structuredClone(value),
          };
          values[key] = structuredClone(value);
        }
        for (const listener of listeners) listener(changes, 'local');
      },
    },
    onChanged: {
      addListener: (listener: Listener) => {
        listeners.add(listener);
      },
      removeListener: (listener: Listener) => {
        listeners.delete(listener);
      },
    },
  },
  runtime: {
    onMessage: { addListener() {}, removeListener() {} },
    async sendMessage(message: unknown) {
      if (!isExtensionMessage(message)) throw new Error('Unsupported demo message');
      if (message.type === ExtensionMessageTypes.OPEN_SETTINGS) {
        window.dispatchEvent(new Event('keymove-demo:settings'));
      } else if (message.type === ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB) {
        // Websites cannot promise the extension's foreground/background tab behavior.
        // Keep the user in the playground and explicitly acknowledge this boundary.
        notifyDemo(
          'Opening foreground or background tabs is available in the installed extension. Try Open link here instead.',
        );
      }
    },
  },
};
