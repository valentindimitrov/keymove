import { boundedEditDistance, fuzzyMatchInText, maxDistanceForQuery } from './fuzzy_match.js';

test('counts an adjacent transposition as a single edit', () => {
  expect(boundedEditDistance('teh', 'the', 2)).toBe(1);
  expect(boundedEditDistance('recieve', 'receive', 2)).toBe(1);
});

test('counts substitutions, insertions, and deletions', () => {
  expect(boundedEditDistance('save', 'save', 2)).toBe(0);
  expect(boundedEditDistance('save', 'sace', 2)).toBe(1);
  expect(boundedEditDistance('save', 'sve', 2)).toBe(1);
  expect(boundedEditDistance('save', 'saave', 2)).toBe(1);
  expect(boundedEditDistance('save', 'sacf', 2)).toBe(2);
});

test('reports anything past the budget as over budget rather than its true distance', () => {
  expect(boundedEditDistance('save', 'delete', 2)).toBe(3);
  expect(boundedEditDistance('save', 'save the document', 2)).toBe(3);
  expect(boundedEditDistance('', 'save', 2)).toBe(3);
});

test('scales the error budget with query length and refuses very short queries', () => {
  expect(maxDistanceForQuery('sa')).toBe(0);
  expect(maxDistanceForQuery('sav')).toBe(1);
  expect(maxDistanceForQuery('settin')).toBe(2);
});

test('returns the closest word as a verbatim slice of the text', () => {
  const match = fuzzyMatchInText('open the setings panel', 'settings', 2);

  expect(match).toEqual({ term: 'setings', distance: 1 });
  expect('open the setings panel').toContain(match!.term);
});

test('keeps the shape of a multi-word query by comparing equal-length windows', () => {
  expect(fuzzyMatchInText('go to acount setings now', 'account settings', 2)).toEqual({
    term: 'acount setings',
    distance: 2,
  });
});

test('prefers the closest candidate over the first one found', () => {
  expect(fuzzyMatchInText('sace and then save', 'save', 1)).toEqual({ term: 'save', distance: 0 });
});

test('reports no match when nothing comes within the budget', () => {
  expect(fuzzyMatchInText('completely unrelated words', 'settings', 2)).toBeNull();
  expect(fuzzyMatchInText('settings', 'settings', 0)).toBeNull();
  expect(fuzzyMatchInText('', 'settings', 2)).toBeNull();
});

test('does not match a window with fewer words than the query', () => {
  expect(fuzzyMatchInText('settings', 'account settings', 2)).toBeNull();
});
