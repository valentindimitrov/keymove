import React from 'react';
import { KEYMOVE_CURRENT_HIGHLIGHT_NAME, KEYMOVE_HIGHLIGHT_NAME } from '../constants.js';
import {
  DEFAULT_HIGHLIGHT_COLORS,
  inkForHexColor,
  rgbaForHexColor,
} from '../lib/highlight_colors_schema.js';
import { visibleTextNodes } from '../lib/visible_text.js';
// Highlighting needs only the node and the slice that matched, not the rest of a result.
type HighlightTarget = { node: Element; term: string };

const MAX_HIGHLIGHT_RANGES = 500;

function rangesForTextNode(textNode: Text, query: string): Range[] {
  return rangesForTextNodes([textNode], query);
}

function rangesForTextNodes(
  textNodes: Text[],
  query: string,
  limit = MAX_HIGHLIGHT_RANGES,
): Range[] {
  if (!query || limit <= 0) return [];
  const text = textNodes.map(node => node.data).join('');
  const normalizedText = text.toLocaleLowerCase().replace(/\u00a0/g, ' ');
  const ranges: Range[] = [];
  let matchIndex = normalizedText.indexOf(query);
  if (matchIndex === -1) return ranges;

  // Most text preserves UTF-16 offsets when lowercased. Only allocate an offset map
  // for expanding characters, using packed integers instead of an object per character.
  let starts: Uint32Array | undefined;
  let ends: Uint32Array | undefined;
  if (normalizedText.length !== text.length) {
    starts = new Uint32Array(normalizedText.length);
    ends = new Uint32Array(normalizedText.length);
    let originalOffset = 0;
    let normalizedOffset = 0;
    for (const character of text) {
      const end = originalOffset + character.length;
      for (let index = 0; index < character.toLocaleLowerCase().length; index += 1) {
        starts[normalizedOffset] = originalOffset;
        ends[normalizedOffset] = end;
        normalizedOffset += 1;
      }
      originalOffset = end;
    }
  }

  let nodeIndex = 0;
  let nodeOffset = 0;
  const boundary = (offset: number, atEnd: boolean): [Text, number] => {
    while (
      nodeIndex < textNodes.length - 1 &&
      (atEnd
        ? offset > nodeOffset + textNodes[nodeIndex]!.length
        : offset >= nodeOffset + textNodes[nodeIndex]!.length)
    ) {
      nodeOffset += textNodes[nodeIndex]!.length;
      nodeIndex += 1;
    }
    return [textNodes[nodeIndex]!, offset - nodeOffset];
  };

  while (matchIndex !== -1 && ranges.length < limit) {
    const range = new Range();
    range.setStart(...boundary(starts?.[matchIndex] ?? matchIndex, false));
    range.setEnd(
      ...boundary(ends?.[matchIndex + query.length - 1] ?? matchIndex + query.length, true),
    );
    ranges.push(range);
    matchIndex = normalizedText.indexOf(query, matchIndex + query.length);
  }

  return ranges;
}

/**
 * Each match carries the term that matched it, which is a verbatim slice of that node's own
 * text. A fuzzy result does not contain the query, so highlighting the query would mark
 * nothing and leave the match invisible on the page.
 */
function highlightRangesForMatches(matches: readonly HighlightTarget[]): Range[] {
  const nodes = matches.map(match => match.node);
  const roots = matches.filter(
    (match, index) =>
      nodes.indexOf(match.node) === index &&
      !nodes.some(other => other !== match.node && other.contains(match.node)),
  );
  const ranges: Range[] = [];
  for (const match of roots) {
    if (ranges.length === MAX_HIGHLIGHT_RANGES) break;
    ranges.push(
      ...rangesForTextNodes(
        visibleTextNodes(match.node),
        match.term,
        MAX_HIGHLIGHT_RANGES - ranges.length,
      ),
    );
  }
  return ranges;
}

function highlightRangesForNodes(nodes: Element[], query: string): Range[] {
  return highlightRangesForMatches(nodes.map(node => ({ node, term: query })));
}

type HighlightOptions = {
  matches: readonly HighlightTarget[];
  selectedMatch?: HighlightTarget | null;
  enabled?: boolean;
  color?: string;
};

const useHighlights = ({
  matches,
  selectedMatch = null,
  enabled = true,
  color = DEFAULT_HIGHLIGHT_COLORS.text,
}: HighlightOptions) => {
  // ::highlight() cannot be styled per element, so the chosen colour reaches it through
  // custom properties on the page root.
  React.useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--keymove-text-accent', color);
    style.setProperty('--keymove-text-wash', rgbaForHexColor(color, 0.28));
    style.setProperty('--keymove-text-ink', inkForHexColor(color));
    return () => {
      style.removeProperty('--keymove-text-accent');
      style.removeProperty('--keymove-text-wash');
      style.removeProperty('--keymove-text-ink');
    };
  }, [color]);

  React.useEffect(() => {
    const highlightRegistry = typeof CSS !== 'undefined' ? CSS.highlights : null;

    if (
      !highlightRegistry ||
      typeof window.Highlight === 'undefined' ||
      !enabled ||
      matches.length === 0
    ) {
      return undefined;
    }

    const ranges = highlightRangesForMatches(matches);
    highlightRegistry.set(KEYMOVE_HIGHLIGHT_NAME, new window.Highlight(...ranges));

    // The current match is painted by its own highlight so it reads differently from the
    // rest. Both cover the same text, so priority decides which one wins.
    if (selectedMatch) {
      const currentHighlight = new window.Highlight(...highlightRangesForMatches([selectedMatch]));
      currentHighlight.priority = 1;
      highlightRegistry.set(KEYMOVE_CURRENT_HIGHLIGHT_NAME, currentHighlight);
    }

    return () => {
      highlightRegistry.delete(KEYMOVE_HIGHLIGHT_NAME);
      highlightRegistry.delete(KEYMOVE_CURRENT_HIGHLIGHT_NAME);
    };
  }, [matches, selectedMatch, enabled]);
};

export type { HighlightTarget };
export {
  highlightRangesForMatches,
  highlightRangesForNodes,
  rangesForTextNode,
  MAX_HIGHLIGHT_RANGES,
};
export default useHighlights;
