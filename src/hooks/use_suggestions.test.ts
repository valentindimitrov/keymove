import { makeRankedMatch } from '../test_support/factories.js';
import useSuggestions, { applyHysteresis, describeAll } from './use_suggestions.js';
import type { RankedMatch } from '../lib/page_search_index.js';

function match(name: string, score: number, kind: 'action' | 'text' = 'action'): RankedMatch {
  const node = document.createElement('button');
  node.textContent = name;
  node.id = name;
  return makeRankedMatch({ kind, node, score, term: name });
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

test('uses the configured count and keeps the strongest result when only one is requested', () => {
  const candidates = [
    match('a', 20),
    match('b', 19),
    match('c', 18),
    match('d', 17),
    match('text', 5, 'text'),
  ];
  expect(named(applyHysteresis(candidates, [], 1))).toEqual(['a']);
  expect(applyHysteresis(candidates, [], 2).map(row => row.kind)).toEqual(['action', 'text']);
  expect(applyHysteresis(candidates, [], 5)).toHaveLength(5);
  expect(applyHysteresis(candidates, [], 100)).toHaveLength(5);
});

test('adds a new result without disturbing the places already held', () => {
  const first = [match('a', 10), match('b', 9)];
  const grown = withScores(first, { a: 10, b: 9, c: 9.5 });

  expect(named(applyHysteresis(grown, first))).toEqual(['a', 'b', 'c']);
});

test('holds shortlist membership against a near-tied fourth candidate', () => {
  const first = [match('a', 10), match('b', 9), match('c', 8)];
  const incoming = withScores(first, { a: 10, b: 9, c: 8, d: 8.5 });
  expect(named(applyHysteresis(incoming, first))).toEqual(['a', 'b', 'c']);
  expect(named(applyHysteresis(withScores(first, { a: 10, b: 9, c: 8, d: 9.5 }), first))).toEqual([
    'a',
    'b',
    'd',
  ]);
});

test('keeps both kinds and stabilizes the reserved third row too', () => {
  const first = [match('a', 20), match('b', 19), match('text', 5, 'text')];
  const otherText = match('other-text', 5.5, 'text');
  const candidates = [...first.slice(0, 2), match('c', 18), otherText, first[2]!];
  expect(named(applyHysteresis(candidates, first))).toEqual(['a', 'b', 'text']);
  expect(named(applyHysteresis(candidates, []))).toEqual(['a', 'b', 'other-text']);
  otherText.score = 7;
  expect(named(applyHysteresis(candidates, first))).toEqual(['a', 'b', 'other-text']);
});

test('keeps the last rendered slate unchanged through pending searches', () => {
  const first = [match('a', 10), match('b', 9.6), match('c', 9)];
  const props = { suggestions: first, searchText: 'sav', isFuzzy: true, pending: false };
  const { result, rerender } = renderHook(props => useSuggestions(props), { initialProps: props });
  expect(result.current.map(row => row.node.id)).toEqual(['a', 'b', 'c']);
  const displayed = result.current;
  rerender({ ...props, searchText: 'save', pending: true });
  expect(result.current).toBe(displayed);
  rerender({ ...props, searchText: 'save', suggestions: [], pending: true, isFuzzy: false });
  expect(result.current).toBe(displayed);
  rerender({
    ...props,
    searchText: 'save',
    suggestions: withScores(first, { a: 9.8, b: 10, c: 9 }),
  });
  expect(result.current.map(row => row.node.id)).toEqual(['a', 'b', 'c']);
  rerender({ ...props, searchText: 'sa', pending: true });
  expect(result.current).toEqual([]);
  rerender({ ...props, searchText: 'sav', pending: true });
  expect(result.current).toEqual([]);
});

test.each(['short query', 'completed empty search'])('resets history after a %s', reset => {
  const first = [match('a', 10), match('b', 9.6), match('c', 9)];
  const props = { suggestions: first, searchText: 'save', isFuzzy: false, pending: false };
  const { result, rerender } = renderHook(props => useSuggestions(props), { initialProps: props });
  rerender({ ...props, searchText: reset === 'short query' ? 'sa' : 'nothing', suggestions: [] });
  expect(result.current).toEqual([]);
  rerender({ ...props, suggestions: withScores(first, { a: 9.8, b: 10, c: 9 }) });
  expect(result.current.map(row => row.node.id)).toEqual(['b', 'a', 'c']);
});

test('uses fresh match metadata when holding a row', () => {
  const first = [match('a', 10), match('b', 9.6)];
  const fresh = withScores(first, { a: 9.8, b: 10 }).map(row => ({
    ...row,
    term: 'new',
    distance: 1,
  }));
  expect(applyHysteresis(fresh, first)[0]).toMatchObject({
    node: first[0]!.node,
    score: 9.8,
    term: 'new',
    distance: 1,
  });
});

test('reads out the edit distance and the region a result sits in', () => {
  const nav = document.createElement('nav');
  const link = document.createElement('a');
  link.href = '/contributing';
  link.textContent = 'Contributing guidelines';
  nav.append(link);
  document.body.append(nav);

  const [near] = describeAll(
    [makeRankedMatch({ node: link, term: 'contribu', distance: 1 })],
    true,
  );
  expect(near!.context).toBe('link · 1 edit away · in Navigation');

  const [further] = describeAll(
    [makeRankedMatch({ node: link, term: 'contribu', distance: 2 })],
    true,
  );
  expect(further!.context).toBe('link · 2 edits away · in Navigation');

  const [exact] = describeAll(
    [makeRankedMatch({ node: link, term: 'contribu', distance: null })],
    false,
  );
  expect(exact!.context).toBe('link · in Navigation');
});
import { renderHook } from '@testing-library/react';
