const TOP_LEVEL_KEYS = new Set([
  'host',
  'additional_button_selectors',
  'additional_searchable_attributes_by_node_name',
  'relevant_selectors',
  'relevant_word_to_selector_mappings',
  'relevant_words',
  'synonyms',
]);
const SELECTOR_ENTRY_KEYS = new Set(['selector', '_comment']);
const SYNONYM_KEYS = new Set(['directed', 'mutual']);

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

function assertStringArray(value, path, { minimumLength = 0 } = {}) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    fail(path, `must be an array containing at least ${minimumLength} string(s)`);
  }

  value.forEach((entry, index) => assertNonemptyString(entry, `${path}[${index}]`));
}

function assertStringArrayRecord(value, path) {
  assertObject(value, path);
  Object.entries(value).forEach(([key, entries]) => {
    assertNonemptyString(key, `${path} key`);
    assertStringArray(entries, `${path}.${key}`, { minimumLength: 1 });
  });
}

function assertStringRecord(value, path) {
  assertObject(value, path);
  Object.entries(value).forEach(([key, entry]) => {
    assertNonemptyString(key, `${path} key`);
    assertNonemptyString(entry, `${path}.${key}`);
  });
}

function assertSelectorEntries(value, path) {
  if (!Array.isArray(value)) {
    fail(path, 'must be an array');
  }

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertObject(entry, entryPath);
    assertKnownKeys(entry, SELECTOR_ENTRY_KEYS, entryPath);
    assertNonemptyString(entry.selector, `${entryPath}.selector`);
    if (entry._comment !== undefined) {
      assertNonemptyString(entry._comment, `${entryPath}._comment`);
    }
  });
}

function assertSynonyms(value, path) {
  assertObject(value, path);
  assertKnownKeys(value, SYNONYM_KEYS, path);

  if (value.directed !== undefined) {
    assertStringArrayRecord(value.directed, `${path}.directed`);
  }
  if (value.mutual !== undefined) {
    if (!Array.isArray(value.mutual)) {
      fail(`${path}.mutual`, 'must be an array');
    }
    value.mutual.forEach((group, index) => {
      assertStringArray(group, `${path}.mutual[${index}]`, { minimumLength: 2 });
    });
  }
}

function validateAppSpecificSettings(value, source = 'app-specific settings') {
  assertObject(value, source);
  assertKnownKeys(value, TOP_LEVEL_KEYS, source);
  assertNonemptyString(value.host, `${source}.host`);

  if (value.additional_button_selectors !== undefined) {
    assertSelectorEntries(
      value.additional_button_selectors,
      `${source}.additional_button_selectors`,
    );
  }
  if (value.additional_searchable_attributes_by_node_name !== undefined) {
    assertStringArrayRecord(
      value.additional_searchable_attributes_by_node_name,
      `${source}.additional_searchable_attributes_by_node_name`,
    );
  }
  if (value.relevant_selectors !== undefined) {
    assertSelectorEntries(value.relevant_selectors, `${source}.relevant_selectors`);
  }
  if (value.relevant_word_to_selector_mappings !== undefined) {
    assertStringRecord(
      value.relevant_word_to_selector_mappings,
      `${source}.relevant_word_to_selector_mappings`,
    );
  }
  if (value.relevant_words !== undefined) {
    assertStringArray(value.relevant_words, `${source}.relevant_words`);
  }
  if (value.synonyms !== undefined) {
    assertSynonyms(value.synonyms, `${source}.synonyms`);
  }

  return value;
}

export { validateAppSpecificSettings };
