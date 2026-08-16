import React from 'react';
import { keyboardShortcuts } from '../lib/static_data.js';
import Utils from '../lib/utils.js';
import useDocumentEvent from './use_document_event.js';
import type {
  KeyboardShortcut,
  ModifierKey,
  PlatformKeyGroups,
} from '../lib/static_data_schema.js';

type ShortcutHandler = (shortcutName: string, event: KeyboardEvent) => void;

const useKeyboardShortcuts = (handleShortcut: ShortcutHandler) => {
  const isMacOS = React.useMemo(() => Utils.isMacOS(), []);

  const eventMatchesShortcutFlags = React.useCallback(
    (flags: PlatformKeyGroups<ModifierKey>, event: KeyboardEvent, discluded = false) => {
      const currentOSFlags = (isMacOS && flags.mac) || flags.default;
      return currentOSFlags.every(flag => (discluded ? !event[flag] : event[flag]));
    },
    [isMacOS],
  );

  const shortcutMatchesEvent = React.useCallback(
    (shortcut: KeyboardShortcut, event: KeyboardEvent) => {
      const eventMatcher = shortcut.eventMatcher;
      return (
        eventMatcher &&
        (!eventMatcher.code || eventMatcher.code === event.code) &&
        (!eventMatcher.flags || eventMatchesShortcutFlags(eventMatcher.flags, event)) &&
        (!eventMatcher.discludedFlags ||
          eventMatchesShortcutFlags(eventMatcher.discludedFlags, event, true))
      );
    },
    [eventMatchesShortcutFlags],
  );

  const findShortcutMatchingEvent = React.useCallback(
    (event: KeyboardEvent) => {
      return keyboardShortcuts.find(shortcut => shortcutMatchesEvent(shortcut, event));
    },
    [shortcutMatchesEvent],
  );

  const handleKeyEvent = React.useCallback(
    (event: KeyboardEvent) => {
      const matchingShortcut = findShortcutMatchingEvent(event);
      if (matchingShortcut && matchingShortcut.name) {
        handleShortcut(matchingShortcut.name, event);
      }
    },
    [handleShortcut, findShortcutMatchingEvent],
  );

  // Capture shortcuts before page controls can swallow Tab and other key events.
  useDocumentEvent('keydown', true, handleKeyEvent, true);
};

export default useKeyboardShortcuts;
