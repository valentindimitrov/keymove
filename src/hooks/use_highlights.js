import React from 'react';
import { YIPYIP_HIGHLIGHT_NAME } from '../constants.js';

function rangesForTextNode(textNode, query) {
  const text = textNode.textContent || '';
  const normalizedText = text.toLocaleLowerCase();
  const ranges = [];
  let matchIndex = normalizedText.indexOf(query);

  while (matchIndex !== -1) {
    const range = new Range();
    range.setStart(textNode, matchIndex);
    range.setEnd(textNode, matchIndex + query.length);
    ranges.push(range);
    matchIndex = normalizedText.indexOf(query, matchIndex + query.length);
  }

  return ranges;
}

function highlightRangesForNodes(nodes, query) {
  const ranges = [];
  const visitedTextNodes = new Set();

  nodes.forEach(node => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode) {
      if (!visitedTextNodes.has(textNode)) {
        visitedTextNodes.add(textNode);
        ranges.push(...rangesForTextNode(textNode, query));
      }
      textNode = walker.nextNode();
    }
  });

  return ranges;
}

const useHighlights = ({ searchText, matchingNodes }) => {
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
    highlightRegistry.set(YIPYIP_HIGHLIGHT_NAME, new window.Highlight(...ranges));

    return () => highlightRegistry.delete(YIPYIP_HIGHLIGHT_NAME);
  }, [matchingNodes, searchText]);
};

export { highlightRangesForNodes, rangesForTextNode };
export default useHighlights;
