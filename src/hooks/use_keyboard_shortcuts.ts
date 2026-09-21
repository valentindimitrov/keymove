import React from 'react';
import { keyboardShortcuts } from '../lib/static_data.js';
import Utils from '../lib/utils.js';
import {
  DEFAULT_OPENING_SHORTCUT,
  matchesOpeningShortcut,
} from '../lib/interaction_settings_schema.js';
import type { OpeningShortcut } from '../lib/interaction_settings_schema.js';
import type {
  KeyboardShortcut,
  KeyboardShortcutName,
  ModifierKey,
  PlatformKeyGroups,
} from '../lib/static_data_schema.js';

type ShortcutHandler = (shortcutName: KeyboardShortcutName, event: KeyboardEvent) => void;

const useKeyboardShortcuts = (
  handleShortcut: ShortcutHandler,
  openingShortcut: OpeningShortcut = DEFAULT_OPENING_SHORTCUT,
  enabled = true,
) => {
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
      if (event.isComposing || event.defaultPrevented || event.getModifierState('AltGraph')) {
        return;
      }
      return keyboardShortcuts.find(shortcut =>
        shortcut.name === 'focus_searchbar'
          ? matchesOpeningShortcut(event, openingShortcut)
          : shortcutMatchesEvent(shortcut, event),
      );
    },
    [shortcutMatchesEvent, openingShortcut],
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

  // Register during commit so a freshly mounted or revealed bar cannot receive a shortcut
  // before its handler is ready. Capture also beats host controls that swallow key events.
  React.useLayoutEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyEvent, true);
    return () => document.removeEventListener('keydown', handleKeyEvent, true);
  }, [handleKeyEvent, enabled]);
};

export default useKeyboardShortcuts;
