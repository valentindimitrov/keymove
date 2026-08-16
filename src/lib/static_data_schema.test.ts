import { validateKeyboardShortcuts, validateSearchableAttributes } from './static_data_schema.js';

test('rejects unsupported keyboard modifier names', () => {
  expect(() =>
    validateKeyboardShortcuts([
      {
        name: 'next',
        eventMatcher: { code: 'Tab', flags: { default: ['controlKey'] } },
      },
    ]),
  ).toThrow('must be one of altKey, ctrlKey, metaKey, shiftKey');
});

test('requires help text shortcuts to define display keys', () => {
  expect(() =>
    validateKeyboardShortcuts([
      {
        name: 'next',
        eventMatcher: { code: 'Tab' },
        text: 'to jump to the next match',
      },
    ]),
  ).toThrow('displayKeys is required when shortcut text is provided');
});

test('rejects malformed searchable attribute lists', () => {
  expect(() => validateSearchableAttributes({ A: ['title', 42] })).toThrow(
    'searchable attributes.A[1] must be a non-empty string',
  );
});
