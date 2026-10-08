import { Fragment, useSyncExternalStore } from 'react';
import { keyboardShortcuts } from '../src/lib/static_data.js';
import type { KeyboardShortcutName } from '../src/lib/static_data_schema.js';
import Utils from '../src/lib/utils.js';

const subscribe = () => () => {};
const serverPlatform = () => false;

// Read the same platform and key definitions as the extension's shortcut reference.
// Displaying Mac labels must not remap Control shortcuts to Command indiscriminately.
export default function Shortcut({ name }: { name: KeyboardShortcutName }) {
  const isMacOS = useSyncExternalStore(subscribe, Utils.isMacOS, serverPlatform);
  const shortcut = keyboardShortcuts.find(item => item.name === name);
  const keys = (isMacOS && shortcut?.displayKeys?.mac) || shortcut?.displayKeys?.default;
  if (!keys) return null;
  return (
    <span className="shortcut-keys">
      {keys.map((key, index) => (
        <Fragment key={key}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <kbd>{key}</kbd>
        </Fragment>
      ))}
    </span>
  );
}
