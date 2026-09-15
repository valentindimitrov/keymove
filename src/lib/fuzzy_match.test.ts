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

test('matches a typo inside a prefix of a longer word', () => {
  // Exact search already finds "Contributing" from "contribu", so the fallback has to keep
  // working one typo later, when the query is shorter than the word it nearly matches.
  // Several spans sit one edit away here, so only the distance and the span itself are
  // pinned; which of the equally close ones wins is not a promise worth making.
  const match = fuzzyMatchInText('contributing guidelines', 'contribuu', 2);

  expect(match?.distance).toBe(1);
  expect('contributing').toContain(match!.term);
});

test('matches a span that begins part-way through a word, as exact search does', () => {
  const match = fuzzyMatchInText('the settings panel', 'ettingz', 1);

  expect(match?.distance).toBe(1);
  expect(match!.term.startsWith('etting')).toBe(true);
});

test('always returns a term that is present in the text verbatim', () => {
  const cases: [string, string, number][] = [
    ['contributing guidelines', 'contribuu', 2],
    ['open the setings panel', 'settings', 2],
    ['go to acount setings now', 'account settings', 2],
    ['receive mail today', 'recieve', 2],
    ['a b c settings', 'settings', 2],
  ];
  for (const [text, query, budget] of cases) {
    const match = fuzzyMatchInText(text, query, budget);
    expect(match).not.toBeNull();
    expect(text).toContain(match!.term);
  }
});

// Ground truth: try every substring, take the closest. Correct by construction, far too slow
// to ship, which is the point of comparing against it.
function oracle(text: string, query: string, maxDistance: number) {
  let best = maxDistance + 1;
  for (let start = 0; start < text.length; start += 1) {
    for (let end = start + 1; end <= text.length; end += 1) {
      const d = boundedEditDistance(query, text.slice(start, end), maxDistance);
      if (d < best) best = d;
    }
  }
  return best > maxDistance ? null : best;
}

test('agrees with an exhaustive substring oracle across random inputs', () => {
  const alphabet = 'abc ';
  let rng = 987654321;
  const next = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
  const randomString = (maxLength: number, minLength = 0) => {
    const length = minLength + Math.floor(next() * (maxLength - minLength + 1));
    let out = '';
    for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(next() * alphabet.length)];
    return out;
  };

  for (let trial = 0; trial < 6000; trial += 1) {
    const text = randomString(14);
    const query = randomString(6, 1);
    for (const budget of [1, 2]) {
      const expected = oracle(text, query, budget);
      const actual = fuzzyMatchInText(text, query, budget);
      expect({ text, query, budget, distance: actual?.distance ?? null }).toEqual({
        text,
        query,
        budget,
        distance: expected,
      });
      // Whatever it returns must be findable in the text, or highlighting cannot mark it.
      if (actual) expect(text.includes(actual.term)).toBe(true);
    }
  }
});

test('counts supplementary letters as characters, not surrogate halves', () => {
  expect(maxDistanceForQuery('𐐀𐐁')).toBe(0);
  expect(boundedEditDistance('𐐀𐐁', '𐐁𐐀', 1)).toBe(1);
  expect(fuzzyMatchInText('before 𐐀𐐁𐐂 after', '𐐁𐐀𐐂', 1)).toEqual({
    term: '𐐀𐐁𐐂',
    distance: 1,
  });
});
