import {
  MAX_FUZZY_DISTANCE,
  MIN_FUZZY_QUERY_LENGTH,
  SHORT_FUZZY_QUERY_LENGTH,
} from '../constants.js';

type Characters = string | readonly string[];

// Keep the allocation-free BMP path; only supplementary characters need an array.
function characters(text: string): Characters {
  return /[\uD800-\uDFFF]/.test(text) ? Array.from(text) : text;
}

type FuzzyMatch = { term: string; distance: number };

/**
 * Longer queries earn a larger error budget. A single edit in a three-character query
 * changes a third of it, so short queries stay strict to avoid matching everything.
 */
function maxDistanceForQuery(query: string) {
  const length = characters(query).length;
  if (length < MIN_FUZZY_QUERY_LENGTH) return 0;
  return length < SHORT_FUZZY_QUERY_LENGTH ? 1 : MAX_FUZZY_DISTANCE;
}

/**
 * Optimal string alignment distance between two whole strings, which counts an adjacent
 * transposition as one edit rather than two. Returns maxDistance + 1 as soon as the result
 * cannot come in under the budget, so most comparisons stop after a row or two.
 */
function boundedEditDistance(a: string, b: string, maxDistance: number) {
  return sequenceDistance(characters(a), characters(b), maxDistance);
}

function sequenceDistance(a: Characters, b: Characters, maxDistance: number) {
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

/**
 * Finds where the query best matches, allowing the match to begin anywhere rather than only
 * at a word boundary. Exact search matches substrings, so "contribu" already finds
 * "Contributing"; comparing whole words would drop "contribuu" for being three characters
 * shorter than the word it is one edit from.
 *
 * This is the search half of the algorithm: it reports the closest distance and where that
 * match ends, leaving the matching span to be recovered separately.
 */
function bestMatchEnd(text: Characters, query: Characters, maxDistance: number) {
  const queryLength = query.length;
  let twoRowsBack = new Array<number>(queryLength + 1).fill(0);
  let previousRow = new Array<number>(queryLength + 1);
  let currentRow = new Array<number>(queryLength + 1);
  // Row 0 is left at zero for every column, which is what lets a match start anywhere.
  for (let i = 0; i <= queryLength; i += 1) previousRow[i] = i;
  // Rows past this one are already over budget and cannot come back under it.
  let lastActiveRow = Math.min(queryLength, maxDistance + 1);
  let bestDistance = maxDistance + 1;
  let bestEnd = -1;

  for (let column = 0; column < text.length; column += 1) {
    const character = text[column];
    const previousCharacter = column > 0 ? text[column - 1] : undefined;
    currentRow[0] = 0;

    for (let i = 1; i <= lastActiveRow; i += 1) {
      const substitutionCost = query[i - 1] === character ? 0 : 1;
      let cost = Math.min(
        previousRow[i - 1]! + substitutionCost,
        currentRow[i - 1]! + 1,
        previousRow[i]! + 1,
      );
      if (i > 1 && column > 0 && query[i - 1] === previousCharacter && query[i - 2] === character) {
        cost = Math.min(cost, twoRowsBack[i - 2]! + 1);
      }
      currentRow[i] = cost;
    }
    for (let i = lastActiveRow + 1; i <= queryLength; i += 1) currentRow[i] = maxDistance + 1;

    while (lastActiveRow > 0 && currentRow[lastActiveRow]! > maxDistance) lastActiveRow -= 1;
    if (lastActiveRow === queryLength) {
      if (currentRow[queryLength]! < bestDistance) {
        bestDistance = currentRow[queryLength]!;
        bestEnd = column + 1;
      }
    } else {
      lastActiveRow = Math.min(queryLength, lastActiveRow + 1);
    }

    const recycled = twoRowsBack;
    twoRowsBack = previousRow;
    previousRow = currentRow;
    currentRow = recycled;
  }

  return { distance: bestDistance, end: bestEnd };
}

/**
 * Finds the span of text closest to the query. The returned term is a verbatim slice of the
 * text, which lets callers locate it again for highlighting without mapping offsets.
 */
function fuzzyMatchInText(text: string, query: string, maxDistance: number): FuzzyMatch | null {
  if (maxDistance === 0 || text.length === 0 || query.length === 0) return null;

  const textCharacters = characters(text);
  const queryCharacters = characters(query);
  const { distance, end } = bestMatchEnd(textCharacters, queryCharacters, maxDistance);
  if (end === -1 || distance > maxDistance) return null;

  // A match of this distance differs from the query by at most maxDistance characters, so its
  // start is within that of `end - query.length`. Only a handful of offsets need checking,
  // which keeps the scan above free of the bookkeeping needed to track a span.
  const idealStart = end - queryCharacters.length;
  for (let offset = 0; offset <= maxDistance; offset += 1) {
    for (const start of offset === 0 ? [idealStart] : [idealStart - offset, idealStart + offset]) {
      if (start < 0 || start >= end) continue;
      const candidate = textCharacters.slice(start, end);
      if (sequenceDistance(queryCharacters, candidate, maxDistance) === distance) {
        return { term: typeof candidate === 'string' ? candidate : candidate.join(''), distance };
      }
    }
  }
  return null;
}

export { boundedEditDistance, fuzzyMatchInText, maxDistanceForQuery };
