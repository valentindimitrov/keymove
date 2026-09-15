import React from 'react';
import {
  MIN_SUGGESTION_QUERY_LENGTH,
  SUGGESTION_LIMIT,
  SUGGESTION_SWAP_MARGIN,
} from '../constants.js';
import {
  excerptAround,
  kindLabelForNode,
  labelForNode,
  landmarkForNode,
} from '../lib/suggestion_context.js';
import type { RankedMatch } from '../lib/page_search_index.js';

type Suggestion = {
  kind: 'action' | 'text';
  node: Element;
  term: string | null;
  label: string;
  context: string;
};

type SuggestionOptions = {
  suggestions: RankedMatch[];
  searchText: string;
  isFuzzy: boolean;
  pending: boolean;
};

/**
 * Holds the order steady unless a challenger clearly beats the result already in its place.
 * Scores shift on every keystroke, and two results that are effectively tied would otherwise
 * trade places continuously, which makes a numbered row impossible to aim at.
 */
function applyHysteresis(incoming: RankedMatch[], previous: RankedMatch[]): RankedMatch[] {
  const incomingByNode = new Map(incoming.map(match => [match.node, match]));
  const incumbents = previous.flatMap(match => {
    const current = incomingByNode.get(match.node);
    return current?.kind === match.kind ? [current] : [];
  });
  const remaining = new Map(incomingByNode);
  const held: RankedMatch[] = [];
  // incoming contains every distinct candidate in score order, including those outside
  // the previous three. Membership and order are decided together, using current scores.
  while (held.length < SUGGESTION_LIMIT && remaining.size > 0) {
    const challenger = remaining.values().next().value!;
    const incumbent = incumbents[held.length];
    const winner =
      incumbent &&
      remaining.has(incumbent.node) &&
      challenger.score <= incumbent.score * SUGGESTION_SWAP_MARGIN
        ? incumbent
        : challenger;
    held.push(winner);
    remaining.delete(winner.node);
  }
  // Keep the mixed slate. Apply the same margin within the reserved kind so a near-tied
  // alternative cannot churn the third row through this route either.
  if (held.length === SUGGESTION_LIMIT && held.every(match => match.kind === held[0]!.kind)) {
    const challenger = incoming.find(match => match.kind !== held[0]!.kind);
    if (challenger) {
      const incumbent = incumbents.find(match => match.kind === challenger.kind);
      held[held.length - 1] =
        incumbent && challenger.score <= incumbent.score * SUGGESTION_SWAP_MARGIN
          ? incumbent
          : challenger;
    }
  }
  return held;
}

function describe(match: RankedMatch, isFuzzy: boolean): Suggestion {
  const label = labelForNode(match.node, match.kind);
  const { excerpt } = excerptAround(label, match.term);
  const parts = [kindLabelForNode(match.node, match.kind)];
  // How far off an approximate result is says more than the fact that it is approximate.
  if (isFuzzy && match.distance !== null) {
    parts.push(`${match.distance} edit${match.distance === 1 ? '' : 's'} away`);
  }
  const landmark = landmarkForNode(match.node);
  if (landmark) parts.push(`in ${landmark}`);
  return {
    kind: match.kind,
    node: match.node,
    term: match.term,
    label: excerpt,
    context: parts.join(' · '),
  };
}

function describeAll(matches: RankedMatch[], isFuzzy: boolean) {
  return matches.map(match => describe(match, isFuzzy));
}

const useSuggestions = ({ suggestions, searchText, isFuzzy, pending }: SuggestionOptions) => {
  const previous = React.useRef<RankedMatch[]>([]);
  // Below a few characters almost everything matches, and the order churns with every
  // keystroke. There is nothing worth showing yet.
  const enabled = searchText.trim().length >= MIN_SUGGESTION_QUERY_LENGTH;

  const ordered = React.useMemo(
    () => (!enabled || pending ? [] : applyHysteresis(suggestions, previous.current)),
    [enabled, pending, suggestions],
  );
  // Only committed results become history. Pending queries hide stale rows but retain the
  // last slate; a short/cleared query or a completed empty result really ends that history.
  React.useLayoutEffect(() => {
    if (!enabled) previous.current = [];
    else if (!pending) previous.current = ordered;
  }, [enabled, pending, ordered]);
  return React.useMemo(() => describeAll(ordered, isFuzzy), [ordered, isFuzzy]);
};

export type { Suggestion };
export { applyHysteresis, describeAll };
export default useSuggestions;
