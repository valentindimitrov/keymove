import React from 'react';
import { KEYMOVE_HIGHLIGHT_NAME } from '../constants.js';
import { visibleTextNodes } from '../lib/visible_text.js';

function rangesForTextNode(textNode: Text, query: string): Range[] {
  return rangesForTextNodes([textNode], query);
}

function rangesForTextNodes(textNodes: Text[], query: string): Range[] {
  if (!query) return [];
  const positions: { node: Text; start: number; end: number }[] = [];
  let text = '';
  for (const node of textNodes) {
    text += node.data;
    let offset = 0;
    for (const character of node.data) {
      const end = offset + character.length;
      // Lowercasing can expand a character, so normalized offsets are not DOM offsets.
      for (let index = 0; index < character.toLocaleLowerCase().length; index += 1) {
        positions.push({ node, start: offset, end });
      }
      offset = end;
    }
  }
  const normalizedText = text.toLocaleLowerCase().replace(/\u00a0/g, ' ');
  const ranges: Range[] = [];
  let matchIndex = normalizedText.indexOf(query);

  while (matchIndex !== -1) {
    const start = positions[matchIndex];
    const end = positions[matchIndex + query.length - 1];
    if (start && end) {
      const range = new Range();
      range.setStart(start.node, start.start);
      range.setEnd(end.node, end.end);
      ranges.push(range);
    }
    matchIndex = normalizedText.indexOf(query, matchIndex + query.length);
  }

  return ranges;
}

function highlightRangesForNodes(nodes: Element[], query: string): Range[] {
  const roots = [...new Set(nodes)].filter(node =>
    !nodes.some(other => other !== node && other.contains(node)),
  );
  return roots.flatMap(node => rangesForTextNodes(visibleTextNodes(node), query));
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

export { highlightRangesForNodes, rangesForTextNode };
export default useHighlights;
