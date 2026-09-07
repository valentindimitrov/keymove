import React from 'react';
import { MIN_SUGGESTION_QUERY_LENGTH, SUGGESTION_SWAP_MARGIN } from '../constants.js';
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
};

/**
 * Holds the order steady unless a challenger clearly beats the result already in its place.
 * Scores shift on every keystroke, and two results that are effectively tied would otherwise
 * trade places continuously, which makes a numbered row impossible to aim at.
 */
function applyHysteresis(incoming: RankedMatch[], previous: RankedMatch[]): RankedMatch[] {
  if (previous.length === 0) return incoming;
  const incomingByNode = new Map(incoming.map(match => [match.node, match]));
  const held: RankedMatch[] = [];

  for (const previousMatch of previous) {
    const current = incomingByNode.get(previousMatch.node);
    if (!current) continue;
    const challenger = incoming[held.length];
    // The result holding this place keeps it unless something outranks it by the margin.
    if (!challenger || challenger.node === current.node) {
      held.push(current);
    } else if (challenger.score > current.score * SUGGESTION_SWAP_MARGIN) {
      break;
    } else {
      held.push(current);
    }
    incomingByNode.delete(previousMatch.node);
  }

  const remainder = incoming.filter(match => incomingByNode.has(match.node));
  return [...held, ...remainder].slice(0, incoming.length);
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

const useSuggestions = ({ suggestions, searchText, isFuzzy }: SuggestionOptions) => {
  const previous = React.useRef<RankedMatch[]>([]);
  // Below a few characters almost everything matches, and the order churns with every
  // keystroke. There is nothing worth showing yet.
  const enabled = searchText.trim().length >= MIN_SUGGESTION_QUERY_LENGTH;

  return React.useMemo(() => {
    if (!enabled || suggestions.length === 0) {
      previous.current = [];
      return [];
    }
    const ordered = applyHysteresis(suggestions, previous.current);
    previous.current = ordered;
    return ordered.map(match => describe(match, isFuzzy));
  }, [enabled, suggestions, isFuzzy]);
};

export type { Suggestion };
export { applyHysteresis, describeAll };
export default useSuggestions;
