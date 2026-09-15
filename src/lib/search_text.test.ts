import { matchingTextSpans, normalizeSearchText } from './search_text.js';

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
