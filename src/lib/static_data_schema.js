const SHORTCUT_KEYS = new Set(['name', 'eventMatcher', 'displayKeys', 'text']);
const EVENT_MATCHER_KEYS = new Set(['code', 'flags', 'discludedFlags']);
const PLATFORM_KEYS = new Set(['default', 'mac']);
const MODIFIER_KEYS = new Set(['altKey', 'ctrlKey', 'metaKey', 'shiftKey']);

function fail(path, expectation) {
  throw new TypeError(`${path} ${expectation}`);
}

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
}

function assertKnownKeys(value, allowedKeys, path) {
  Object.keys(value).forEach(key => {
    if (!allowedKeys.has(key)) {
      fail(`${path}.${key}`, 'is not a supported property');
    }
  });
}

function assertNonemptyString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
}

function assertStringArray(value, path) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(path, 'must be a non-empty array of strings');
  }
  value.forEach((entry, index) => assertNonemptyString(entry, `${path}[${index}]`));
}

function assertPlatformKeyGroups(value, path, validateKey) {
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

function validateKeyboardShortcuts(value, source = 'keyboard shortcuts') {
  if (!Array.isArray(value) || value.length === 0) {
    fail(source, 'must be a non-empty array');
  }

  const names = new Set();
  value.forEach((shortcut, index) => {
    const path = `${source}[${index}]`;
    assertObject(shortcut, path);
    assertKnownKeys(shortcut, SHORTCUT_KEYS, path);
    assertNonemptyString(shortcut.name, `${path}.name`);
    if (names.has(shortcut.name)) {
      fail(`${path}.name`, `duplicates shortcut "${shortcut.name}"`);
    }
    names.add(shortcut.name);

    assertObject(shortcut.eventMatcher, `${path}.eventMatcher`);
    assertKnownKeys(shortcut.eventMatcher, EVENT_MATCHER_KEYS, `${path}.eventMatcher`);
    if (shortcut.eventMatcher.code !== undefined) {
      assertNonemptyString(shortcut.eventMatcher.code, `${path}.eventMatcher.code`);
    }
    ['flags', 'discludedFlags'].forEach(property => {
      if (shortcut.eventMatcher[property] !== undefined) {
        assertPlatformKeyGroups(
          shortcut.eventMatcher[property],
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

  return value;
}

function validateSearchableAttributes(value, source = 'searchable attributes') {
  assertObject(value, source);
  Object.entries(value).forEach(([nodeName, attributes]) => {
    assertNonemptyString(nodeName, `${source} node name`);
    assertStringArray(attributes, `${source}.${nodeName}`);
    if (new Set(attributes).size !== attributes.length) {
      fail(`${source}.${nodeName}`, 'must not contain duplicate attributes');
    }
  });
  return value;
}

export { validateKeyboardShortcuts, validateSearchableAttributes };
