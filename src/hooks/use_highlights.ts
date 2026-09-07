import React from 'react';
import { KEYMOVE_HIGHLIGHT_NAME } from '../constants.js';
import { visibleTextNodes } from '../lib/visible_text.js';
import type { TextMatch } from '../lib/page_search_index.js';

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
function highlightRangesForMatches(matches: TextMatch[]): Range[] {
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
  return highlightRangesForMatches(nodes.map(node => ({ node, action: null, term: query })));
}

type HighlightOptions = { matches: TextMatch[] };

const useHighlights = ({ matches }: HighlightOptions) => {
  React.useEffect(() => {
    const highlightRegistry = typeof CSS !== 'undefined' ? CSS.highlights : null;

    if (!highlightRegistry || typeof window.Highlight === 'undefined' || matches.length === 0) {
      return undefined;
    }

    const ranges = highlightRangesForMatches(matches);
    highlightRegistry.set(KEYMOVE_HIGHLIGHT_NAME, new window.Highlight(...ranges));

    return () => {
      highlightRegistry.delete(KEYMOVE_HIGHLIGHT_NAME);
    };
  }, [matches]);
};

export {
  highlightRangesForMatches,
  highlightRangesForNodes,
  rangesForTextNode,
  MAX_HIGHLIGHT_RANGES,
};
export default useHighlights;
