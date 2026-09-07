import { applyHysteresis } from './use_suggestions.js';
import type { RankedMatch } from '../lib/page_search_index.js';

function match(name: string, score: number, kind: 'action' | 'text' = 'action'): RankedMatch {
  const node = document.createElement('button');
  node.textContent = name;
  node.id = name;
  return { kind, node, score, term: name };
}

function named(matches: RankedMatch[]) {
  return matches.map(entry => entry.node.id);
}

function withScores(previous: RankedMatch[], scores: Record<string, number>) {
  return Object.entries(scores)
    .map(([id, score]) => {
      const existing = previous.find(entry => entry.node.id === id);
      return existing ? { ...existing, score } : match(id, score);
    })
    .sort((left, right) => right.score - left.score);
}

test('keeps the running order when scores barely move', () => {
  const first = [match('a', 10), match('b', 9.6), match('c', 9)];
  // b edges ahead of a, but not by enough to be worth moving a row people are aiming at.
  const nudged = withScores(first, { a: 9.8, b: 10, c: 9 });

  expect(named(applyHysteresis(nudged, first))).toEqual(['a', 'b', 'c']);
});

test('gives up and returns to score order once a result decisively wins', () => {
  const first = [match('a', 10), match('b', 9), match('c', 8)];
  const decisive = withScores(first, { a: 5, b: 20, c: 8 });

  // Holding the old order past a change this large would misrepresent the ranking, so the
  // whole slate reverts to score order rather than only swapping the first place.
  expect(named(applyHysteresis(decisive, first))).toEqual(['b', 'c', 'a']);
});

test('drops a result that stopped matching and pulls the rest up', () => {
  const first = [match('a', 10), match('b', 9), match('c', 8)];
  const withoutB = withScores(first, { a: 10, c: 8 });

  expect(named(applyHysteresis(withoutB, first))).toEqual(['a', 'c']);
});

test('takes the incoming order when there is nothing to hold on to', () => {
  const incoming = [match('a', 10), match('b', 9)];

  expect(named(applyHysteresis(incoming, []))).toEqual(['a', 'b']);
});

test('adds a new result without disturbing the places already held', () => {
  const first = [match('a', 10), match('b', 9)];
  const grown = withScores(first, { a: 10, b: 9, c: 9.5 });

  expect(named(applyHysteresis(grown, first))).toEqual(['a', 'b', 'c']);
});
