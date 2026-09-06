import React from 'react';
import { KEYMOVE_HIGHLIGHT_NAME } from '../constants.js';
import { visibleTextNodes } from '../lib/visible_text.js';

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

function highlightRangesForNodes(nodes: Element[], query: string): Range[] {
  const roots = [...new Set(nodes)].filter(
    node => !nodes.some(other => other !== node && other.contains(node)),
  );
  const ranges: Range[] = [];
  for (const node of roots) {
    if (ranges.length === MAX_HIGHLIGHT_RANGES) break;
    ranges.push(
      ...rangesForTextNodes(visibleTextNodes(node), query, MAX_HIGHLIGHT_RANGES - ranges.length),
    );
  }
  return ranges;
}

type HighlightOptions = { searchText: string; matchingNodes: Element[] };

const useHighlights = ({ searchText, matchingNodes }: HighlightOptions) => {
  React.useEffect(() => {
    const highlightRegistry = typeof CSS !== 'undefined' ? CSS.highlights : null;
    const normalizedQuery = searchText.toLocaleLowerCase().trimStart();

    if (
      !highlightRegistry ||
      typeof window.Highlight === 'undefined' ||
      normalizedQuery.length < 2
    ) {
      return undefined;
    }

    const ranges = highlightRangesForNodes(matchingNodes, normalizedQuery);
    highlightRegistry.set(KEYMOVE_HIGHLIGHT_NAME, new window.Highlight(...ranges));

    return () => {
      highlightRegistry.delete(KEYMOVE_HIGHLIGHT_NAME);
    };
  }, [matchingNodes, searchText]);
};

export { highlightRangesForNodes, rangesForTextNode, MAX_HIGHLIGHT_RANGES };
export default useHighlights;
