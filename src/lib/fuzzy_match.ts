import {
  MAX_FUZZY_DISTANCE,
  MIN_FUZZY_QUERY_LENGTH,
  SHORT_FUZZY_QUERY_LENGTH,
} from '../constants.js';

type FuzzyMatch = { term: string; distance: number };

const WORD_REGEX = /[^\s]+/g;

type Word = { start: number; end: number };

/**
 * Longer queries earn a larger error budget. A single edit in a three-character query
 * changes a third of it, so short queries stay strict to avoid matching everything.
 */
function maxDistanceForQuery(query: string) {
  if (query.length < MIN_FUZZY_QUERY_LENGTH) return 0;
  return query.length < SHORT_FUZZY_QUERY_LENGTH ? 1 : MAX_FUZZY_DISTANCE;
}

/**
 * Optimal string alignment distance, which counts an adjacent transposition as one edit
 * rather than two. Returns maxDistance + 1 as soon as the result cannot come in under the
 * budget, so most comparisons stop after a row or two.
 */
function boundedEditDistance(a: string, b: string, maxDistance: number) {
  const exceeded = maxDistance + 1;
  if (Math.abs(a.length - b.length) > maxDistance) return exceeded;
  if (a === b) return 0;
  if (a.length === 0) return b.length > maxDistance ? exceeded : b.length;
  if (b.length === 0) return a.length > maxDistance ? exceeded : a.length;

  let twoRowsBack: number[] = [];
  let previousRow: number[] = Array.from({ length: b.length + 1 }, (_, index) => index);
  let currentRow: number[] = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    currentRow[0] = i;
    // Cells outside this band can only be reached by more than maxDistance edits.
    const from = Math.max(1, i - maxDistance);
    const to = Math.min(b.length, i + maxDistance);
    if (from > 1) currentRow[from - 1] = exceeded;
    let rowMinimum = exceeded;

    for (let j = from; j <= to; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      let cost = Math.min(
        (currentRow[j - 1] ?? exceeded) + 1,
        (previousRow[j] ?? exceeded) + 1,
        (previousRow[j - 1] ?? exceeded) + substitutionCost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cost = Math.min(cost, (twoRowsBack[j - 2] ?? exceeded) + 1);
      }
      currentRow[j] = cost;
      if (cost < rowMinimum) rowMinimum = cost;
    }

    if (to < b.length) currentRow[to + 1] = exceeded;
    if (rowMinimum > maxDistance) return exceeded;

    twoRowsBack = previousRow;
    previousRow = currentRow;
    currentRow = new Array<number>(b.length + 1);
  }

  const distance = previousRow[b.length] ?? exceeded;
  return distance > maxDistance ? exceeded : distance;
}

function wordsWithOffsets(text: string): Word[] {
  const words: Word[] = [];
  WORD_REGEX.lastIndex = 0;
  let match = WORD_REGEX.exec(text);
  while (match) {
    words.push({ start: match.index, end: match.index + match[0].length });
    match = WORD_REGEX.exec(text);
  }
  return words;
}

/**
 * Finds the span of text closest to the query, comparing windows of the same word count so
 * that a multi-word query keeps its shape. The returned term is a verbatim slice of the
 * text, which lets callers locate it again for highlighting without mapping offsets.
 */
function fuzzyMatchInText(text: string, query: string, maxDistance: number): FuzzyMatch | null {
  if (maxDistance === 0 || text.length === 0) return null;

  const queryWordCount = query.trim().split(/\s+/).length;
  const words = wordsWithOffsets(text);
  if (words.length < queryWordCount) return null;

  let best: FuzzyMatch | null = null;
  for (let index = 0; index + queryWordCount <= words.length; index += 1) {
    const start = words[index]!.start;
    const end = words[index + queryWordCount - 1]!.end;
    const candidate = text.slice(start, end);
    if (Math.abs(candidate.length - query.length) > maxDistance) continue;
    const distance = boundedEditDistance(query, candidate, maxDistance);
    if (distance > maxDistance) continue;
    if (!best || distance < best.distance) {
      best = { term: candidate, distance };
      if (distance === 0) break;
    }
  }
  return best;
}

export type { FuzzyMatch };
export { boundedEditDistance, fuzzyMatchInText, maxDistanceForQuery };
