// @vitest-environment node
import { matchingTextSpans, normalizeSearchText } from './search_text.js';

test('preserves ASCII spacing and applies Unicode rules to mixed text', () => {
  expect(normalizeSearchText('SAVE\tSETTINGS 123')).toBe('save\tsettings 123');
  expect(normalizeSearchText('SAVE\u00a0CAFE\u0301 Σ')).toBe('save café σ');
});

test.each([
  ['İstanbul', 'stanbul', 'stanbul'],
  ['Cafe\u0301', 'CAFÉ', 'Cafe\u0301'],
  ['한글', '한', '한'],
  ['ΕΛΛΑΣ', 'ελλας', 'ΕΛΛΑΣ'],
  ['😀𐐀𐐁', '𐐨𐐩', '𐐀𐐁'],
])('maps %s / %s to original text', (text, query, matched) => {
  expect(matchingTextSpans(text, query).map(span => text.slice(span.start, span.end))).toEqual([
    matched,
  ]);
});

test('retains accent distinctions and limits non-overlapping occurrences', () => {
  expect(normalizeSearchText('café')).not.toBe(normalizeSearchText('cafe'));
  expect(matchingTextSpans('İİİ', 'i', 2)).toEqual([
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ]);
  expect(matchingTextSpans('abc', '')).toEqual([]);
});

test('treats spellings that compose only once lowercased as equal', () => {
  // U+01F0 has no uppercase precomposed form: uppercase J plus caron lowercases to it.
  expect(normalizeSearchText('J̌')).toBe(normalizeSearchText('ǰ'));
  expect(matchingTextSpans('Read J̌ava', 'ǰava')).toEqual([{ start: 5, end: 10 }]);
  // A contraction and an expansion that leave the length unchanged still move offsets.
  const text = 'J\u030C cat \u0130';
  expect(matchingTextSpans(text, 'cat').map(span => text.slice(span.start, span.end))).toEqual([
    'cat',
  ]);
});
