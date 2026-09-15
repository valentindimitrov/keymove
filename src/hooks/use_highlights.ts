import React from 'react';
import { KEYMOVE_CURRENT_HIGHLIGHT_NAME, KEYMOVE_HIGHLIGHT_NAME } from '../constants.js';
import {
  DEFAULT_HIGHLIGHT_COLORS,
  inkForHexColor,
  rgbaForHexColor,
} from '../lib/highlight_colors_schema.js';
import { iterateRenderedText } from '../lib/visible_text.js';
import { matchingTextSpans } from '../lib/search_text.js';
import type { StyleCache, RenderedTextPart, TextBoundary } from '../lib/visible_text.js';
// Highlighting needs only the node and the slice that matched, not the rest of a result.
type HighlightTarget = { node: Element; term: string };

const MAX_HIGHLIGHT_RANGES = 500;
const HIGHLIGHT_WORK_BUDGET_MS = 8;
const HIGHLIGHT_CHUNK_SIZE = 100;

function rangesForTextNode(textNode: Text, query: string): Range[] {
  const parts = [...iterateRenderedText(textNode)].filter(part => part !== null);
  return rangesForTextParts(parts, query);
}

function rangesForTextParts(
  parts: RenderedTextPart[],
  query: string,
  limit = MAX_HIGHLIGHT_RANGES,
): Range[] {
  if (!query || limit <= 0) return [];
  const text = parts.map(part => part.searchText).join('');
  const spans = matchingTextSpans(text, query, limit);
  const ranges: Range[] = [];

  let nodeIndex = 0;
  let nodeOffset = 0;
  const boundary = (offset: number, atEnd: boolean): TextBoundary => {
    while (
      nodeIndex < parts.length - 1 &&
      (atEnd
        ? offset > nodeOffset + parts[nodeIndex]!.searchText.length
        : offset >= nodeOffset + parts[nodeIndex]!.searchText.length)
    ) {
      nodeOffset += parts[nodeIndex]!.searchText.length;
      nodeIndex += 1;
    }
    const part = parts[nodeIndex]!;
    return part.linear
      ? [part.start[0], part.start[1] + offset - nodeOffset]
      : atEnd
        ? part.end
        : part.start;
  };

  for (const span of spans) {
    const range = new Range();
    range.setStart(...boundary(span.start, false));
    range.setEnd(...boundary(span.end, true));
    ranges.push(range);
  }

  return ranges;
}

/**
 * Each match carries the term that matched the node's whitespace-aware searchable text.
 * A fuzzy result does not contain the query, so highlighting the query would mark
 * nothing and leave the match invisible on the page.
 */
function* highlightRangeWork(matches: readonly HighlightTarget[]): Generator<void, Range[]> {
  // Collect membership before visiting roots, so an ancestor suppresses its descendant
  // even if the descendant arrived first. Shared ancestor paths are only walked once.
  const nodes = new Set<Element>();
  for (const match of matches) {
    nodes.add(match.node);
    yield;
  }
  const seen = new Set<Element>();
  const coveredAncestors = new WeakMap<Element, boolean>();
  const styles: StyleCache = new WeakMap();
  const ranges: Range[] = [];
  for (const match of matches) {
    yield;
    if (seen.has(match.node)) continue;
    seen.add(match.node);
    const path: Element[] = [];
    let covered = false;
    for (let ancestor = match.node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (nodes.has(ancestor)) {
        covered = true;
        break;
      }
      const cached = coveredAncestors.get(ancestor);
      if (cached !== undefined) {
        covered = cached;
        break;
      }
      path.push(ancestor);
      yield;
    }
    for (const ancestor of path) {
      coveredAncestors.set(ancestor, covered);
      yield;
    }
    if (covered) continue;
    const parts: RenderedTextPart[] = [];
    for (const part of iterateRenderedText(match.node, styles)) {
      if (part) parts.push(part);
      yield;
    }
    ranges.push(...rangesForTextParts(parts, match.term, MAX_HIGHLIGHT_RANGES - ranges.length));
    if (ranges.length === MAX_HIGHLIGHT_RANGES) break;
  }
  return ranges;
}

function highlightRangesForMatches(matches: readonly HighlightTarget[]): Range[] {
  const work = highlightRangeWork(matches);
  let step = work.next();
  while (!step.done) step = work.next();
  return step.value;
}

// Small updates publish immediately. Larger ones yield while preparing membership,
// ancestor paths and visible text, and cleanup cancels an obsolete query's remaining work.
function scheduleHighlightRanges(
  matches: readonly HighlightTarget[],
  publish: (ranges: Range[]) => void,
) {
  const work = highlightRangeWork(matches);
  let timer: number | undefined;
  const resume = () => {
    const deadline = performance.now() + HIGHLIGHT_WORK_BUDGET_MS;
    let processed = 0;
    while (true) {
      const step = work.next();
      if (step.done) {
        publish(step.value);
        return;
      }
      if (++processed % HIGHLIGHT_CHUNK_SIZE === 0 && performance.now() >= deadline) {
        timer = window.setTimeout(resume, 0);
        return;
      }
    }
  };
  resume();
  return () => {
    window.clearTimeout(timer);
    work.return([]);
  };
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

    const cancel = scheduleHighlightRanges(matches, ranges => {
      highlightRegistry.set(KEYMOVE_HIGHLIGHT_NAME, new window.Highlight(...ranges));
    });

    return () => {
      cancel();
      highlightRegistry.delete(KEYMOVE_HIGHLIGHT_NAME);
    };
  }, [matches, enabled]);

  // Moving the cursor only changes this highlight, leaving the general ranges intact.
  React.useEffect(() => {
    const highlightRegistry = typeof CSS !== 'undefined' ? CSS.highlights : null;
    if (!highlightRegistry || typeof window.Highlight === 'undefined' || !enabled || !selectedMatch)
      return undefined;
    const cancel = scheduleHighlightRanges([selectedMatch], ranges => {
      const currentHighlight = new window.Highlight(...ranges);
      currentHighlight.priority = 1;
      highlightRegistry.set(KEYMOVE_CURRENT_HIGHLIGHT_NAME, currentHighlight);
    });
    return () => {
      cancel();
      highlightRegistry.delete(KEYMOVE_CURRENT_HIGHLIGHT_NAME);
    };
  }, [selectedMatch, enabled]);
};

export {
  highlightRangesForMatches,
  highlightRangesForNodes,
  rangesForTextNode,
  MAX_HIGHLIGHT_RANGES,
};
export default useHighlights;
