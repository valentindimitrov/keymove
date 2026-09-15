import React from 'react';
import {
  MIN_SUGGESTION_QUERY_LENGTH,
  DEFAULT_SUGGESTION_COUNT,
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
  count?: number;
};

/**
 * Holds the order steady unless a challenger clearly beats the result already in its place.
 * Scores shift on every keystroke, and two results that are effectively tied would otherwise
 * trade places continuously, which makes a numbered row impossible to aim at.
 */
function applyHysteresis(
  incoming: RankedMatch[],
  previous: RankedMatch[],
  count = DEFAULT_SUGGESTION_COUNT,
): RankedMatch[] {
  const incomingByNode = new Map(incoming.map(match => [match.node, match]));
  const incumbents = previous.flatMap(match => {
    const current = incomingByNode.get(match.node);
    return current?.kind === match.kind ? [current] : [];
  });
  const remaining = new Map(incomingByNode);
  const held: RankedMatch[] = [];
  // incoming contains every distinct candidate in score order, including those outside
  // the previous slate. Membership and order are decided together, using current scores.
  while (held.length < count && remaining.size > 0) {
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
  // alternative cannot churn the last row through this route either.
  if (count > 1 && held.length === count && held.every(match => match.kind === held[0]!.kind)) {
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

const useSuggestions = ({
  suggestions,
  searchText,
  isFuzzy,
  pending,
  count = DEFAULT_SUGGESTION_COUNT,
}: SuggestionOptions) => {
  const previous = React.useRef<RankedMatch[]>([]);
  const displayed = React.useRef<Suggestion[]>([]);
  // Below a few characters almost everything matches, and the order churns with every
  // keystroke. There is nothing worth showing yet.
  const enabled = searchText.trim().length >= MIN_SUGGESTION_QUERY_LENGTH;

  const ordered = React.useMemo(
    () => (!enabled || pending ? [] : applyHysteresis(suggestions, previous.current, count)),
    [enabled, pending, suggestions, count],
  );
  const described = React.useMemo(
    () => (!enabled ? [] : pending ? displayed.current : describeAll(ordered, isFuzzy)),
    [enabled, pending, ordered, isFuzzy],
  );
  // Keep the committed presentation intact while searching, including fuzzy labels. The
  // caller disables selection until fresh results arrive. Short or empty queries clear it.
  React.useLayoutEffect(() => {
    if (!enabled) previous.current = [];
    else if (!pending) previous.current = ordered;
    if (!enabled || !pending) displayed.current = described;
  }, [enabled, pending, ordered, described]);
  return described;
};

export type { Suggestion };
export { applyHysteresis, describeAll };
export default useSuggestions;
