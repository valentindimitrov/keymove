const SHORTCUT_KEYS = new Set(['name', 'eventMatcher', 'displayKeys', 'text']);
const EVENT_MATCHER_KEYS = new Set(['code', 'flags', 'discludedFlags']);
const PLATFORM_KEYS = new Set(['default', 'mac']);
const MODIFIER_KEYS = new Set(['altKey', 'ctrlKey', 'metaKey', 'shiftKey']);

type ModifierKey = 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey';
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
  name: string;
  eventMatcher: ShortcutEventMatcher;
  displayKeys?: PlatformKeyGroups;
  text?: string;
};
type SearchableAttributes = Record<string, string[]>;
type JsonObject = Record<string, unknown>;

function fail(path: string, expectation: string): never {
  throw new TypeError(`${path} ${expectation}`);
}

function assertObject(value: unknown, path: string): asserts value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
}

function assertKnownKeys(value: JsonObject, allowedKeys: ReadonlySet<string>, path: string) {
  Object.keys(value).forEach(key => {
    if (!allowedKeys.has(key)) {
      fail(`${path}.${key}`, 'is not a supported property');
    }
  });
}

function assertNonemptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(path, 'must be a non-empty array of strings');
  }
  value.forEach((entry, index) => assertNonemptyString(entry, `${path}[${index}]`));
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
    assertStringArray(keys, `${path}.${platform}`);
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

  const names = new Set<string>();
  value.forEach((shortcut, index) => {
    const path = `${source}[${index}]`;
    assertObject(shortcut, path);
    assertKnownKeys(shortcut, SHORTCUT_KEYS, path);
    assertNonemptyString(shortcut.name, `${path}.name`);
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

  return value as KeyboardShortcut[];
}

function validateSearchableAttributes(
  value: unknown,
  source = 'searchable attributes',
): SearchableAttributes {
  assertObject(value, source);
  Object.entries(value).forEach(([nodeName, attributes]) => {
    assertNonemptyString(nodeName, `${source} node name`);
    assertStringArray(attributes, `${source}.${nodeName}`);
    if (new Set(attributes).size !== attributes.length) {
      fail(`${source}.${nodeName}`, 'must not contain duplicate attributes');
    }
  });
  return value as SearchableAttributes;
}

export type {
  KeyboardShortcut,
  ModifierKey,
  PlatformKeyGroups,
  SearchableAttributes,
  ShortcutEventMatcher,
};
export { validateKeyboardShortcuts, validateSearchableAttributes };
