import {
  assertKnownKeys,
  assertNonemptyString,
  assertObject,
  assertStringArray,
  fail,
} from './runtime_schema.js';

const SHORTCUT_KEYS = new Set(['name', 'eventMatcher', 'displayKeys', 'text']);
const EVENT_MATCHER_KEYS = new Set(['code', 'flags', 'discludedFlags']);
const PLATFORM_KEYS = new Set(['default', 'mac']);
const MODIFIER_KEYS = new Set(['altKey', 'ctrlKey', 'metaKey', 'shiftKey']);
const KEYBOARD_SHORTCUT_NAMES = [
  'next_match',
  'previous_match',
  'next_action_match',
  'previous_action_match',
  'toggle_search_mode',
  'select_match',
  'open_match_in_foreground_tab',
  'open_match_in_background_tab',
  'copy_selected_link',
  'clear_searchbar',
  'focus_searchbar',
  'clear_search_or_hide',
  'select_listed_match_1',
  'select_listed_match_2',
  'select_listed_match_3',
  'select_listed_match_4',
  'select_listed_match_5',
] as const;
const KEYBOARD_SHORTCUT_NAME_SET: ReadonlySet<string> = new Set(KEYBOARD_SHORTCUT_NAMES);

type ModifierKey = 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey';
type KeyboardShortcutName = (typeof KEYBOARD_SHORTCUT_NAMES)[number];
type PlatformKeyGroups<T extends string = string> = {
  default: T[];
  mac?: T[];
};
type ShortcutEventMatcher = {
  code?: string;
  flags?: PlatformKeyGroups<ModifierKey>;
  discludedFlags?: PlatformKeyGroups<ModifierKey>;
};
type KeyboardShortcut = {
  name: KeyboardShortcutName;
  eventMatcher: ShortcutEventMatcher;
  displayKeys?: PlatformKeyGroups;
  text?: string;
};
type SearchableAttributes = Record<string, string[]>;
function assertKeyboardShortcutName(
  value: unknown,
  path: string,
): asserts value is KeyboardShortcutName {
  assertNonemptyString(value, path);
  if (!KEYBOARD_SHORTCUT_NAME_SET.has(value)) {
    fail(path, `must be one of ${KEYBOARD_SHORTCUT_NAMES.join(', ')}`);
  }
}

function assertPlatformKeyGroups(
  value: unknown,
  path: string,
  validateKey: (key: string, path: string) => void,
) {
  assertObject(value, path);
  assertKnownKeys(value, PLATFORM_KEYS, path);
  if (!Object.hasOwn(value, 'default')) {
    fail(`${path}.default`, 'is required');
  }

  Object.entries(value).forEach(([platform, keys]) => {
    assertStringArray(keys, `${path}.${platform}`, {
      minimumLength: 1,
      expectation: 'must be a non-empty array of strings',
    });
    keys.forEach((key, index) => validateKey(key, `${path}.${platform}[${index}]`));
  });
}

function validateKeyboardShortcuts(
  value: unknown,
  source = 'keyboard shortcuts',
): KeyboardShortcut[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(source, 'must be a non-empty array');
  }

  const names = new Set<KeyboardShortcutName>();
  value.forEach((shortcut, index) => {
    const path = `${source}[${index}]`;
    assertObject(shortcut, path);
    assertKnownKeys(shortcut, SHORTCUT_KEYS, path);
    assertKeyboardShortcutName(shortcut.name, `${path}.name`);
    if (names.has(shortcut.name)) {
      fail(`${path}.name`, `duplicates shortcut "${shortcut.name}"`);
    }
    names.add(shortcut.name);

    const eventMatcher = shortcut.eventMatcher;
    assertObject(eventMatcher, `${path}.eventMatcher`);
    assertKnownKeys(eventMatcher, EVENT_MATCHER_KEYS, `${path}.eventMatcher`);
    if (eventMatcher.code !== undefined) {
      assertNonemptyString(eventMatcher.code, `${path}.eventMatcher.code`);
    }
    (['flags', 'discludedFlags'] as const).forEach(property => {
      if (eventMatcher[property] !== undefined) {
        assertPlatformKeyGroups(
          eventMatcher[property],
          `${path}.eventMatcher.${property}`,
          (key, keyPath) => {
            if (!MODIFIER_KEYS.has(key)) {
              fail(keyPath, `must be one of ${[...MODIFIER_KEYS].join(', ')}`);
            }
          },
        );
      }
    });

    if (shortcut.text !== undefined) {
      assertNonemptyString(shortcut.text, `${path}.text`);
      if (shortcut.displayKeys === undefined) {
        fail(`${path}.displayKeys`, 'is required when shortcut text is provided');
      }
    }
    if (shortcut.displayKeys !== undefined) {
      assertPlatformKeyGroups(shortcut.displayKeys, `${path}.displayKeys`, assertNonemptyString);
    }
  });

  KEYBOARD_SHORTCUT_NAMES.forEach(name => {
    if (!names.has(name)) {
      fail(source, `is missing shortcut "${name}"`);
    }
  });

  return value as KeyboardShortcut[];
}

function validateSearchableAttributes(
  value: unknown,
  source = 'searchable attributes',
): SearchableAttributes {
  assertObject(value, source);
  Object.entries(value).forEach(([nodeName, attributes]) => {
    assertNonemptyString(nodeName, `${source} node name`);
    assertStringArray(attributes, `${source}.${nodeName}`, {
      minimumLength: 1,
      expectation: 'must be a non-empty array of strings',
    });
    if (new Set(attributes).size !== attributes.length) {
      fail(`${source}.${nodeName}`, 'must not contain duplicate attributes');
    }
  });
  return value as SearchableAttributes;
}

export type {
  KeyboardShortcut,
  KeyboardShortcutName,
  ModifierKey,
  PlatformKeyGroups,
  SearchableAttributes,
  ShortcutEventMatcher,
};
export { KEYBOARD_SHORTCUT_NAMES, validateKeyboardShortcuts, validateSearchableAttributes };
