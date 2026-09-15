import {
  ACTION_PRIORITY_BOOST,
  DO_NOT_SEARCH_NODE_TYPES,
  KEYMOVE_ROOT_ID,
  MIN_SUGGESTION_QUERY_LENGTH,
} from '../constants.js';
import NodeScorer from './node_scorer.js';
import {
  ACTIONABLE_SELECTOR,
  isLinkOrButtonOrInput,
  searchableAttributeValuesForNode,
} from './searchable_attributes.js';
import { isTextVisible, iterateVisibleTextNodes } from './visible_text.js';
import type { StyleCache } from './visible_text.js';

const SEARCH_CHUNK_SIZE = 100;
const SEARCH_WORK_BUDGET_MS = 8;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;
const TEXT_BLOCK_SELECTOR =
  'p, li, blockquote, pre, td, th, dt, dd, figcaption, h1, h2, h3, h4, h5, h6';

type SearchRecord = {
  attributeValues: string[];
};

type ActionMatch = {
  node: HTMLElement;
  score: number;
  term: string | null;
  distance: number | null;
};
// `term` is the literal slice of the node's text that matched, so highlighting can find it
// again. For an exact search it is the query; for a fuzzy one it is the near-miss spelling.
type TextMatch = {
  node: Element;
  action: HTMLElement | null;
  term: string;
  score: number;
  distance: number | null;
};
type ScannedNode = { node: Element; innerText: string; attributeValues: string[] };
// `distance` is how many edits separate the query from what matched, for approximate
// results only. It is what lets a row say how much of a stretch it is.
type RankedMatch = {
  kind: 'action' | 'text';
  node: Element;
  score: number;
  term: string | null;
  distance: number | null;
};
type MatchCollector = {
  actions: ActionMatch[];
  matchingText: TextMatch[];
  textMatchesByContainer: Map<Element, TextMatch>;
};
type SearchOptions = { signal?: AbortSignal };
type SearchResult = {
  matchingText: TextMatch[];
  matchingLinksAndButtons: HTMLElement[];
  // All distinct candidates in score order. The UI applies stability before choosing three.
  suggestions: RankedMatch[];
  isFuzzy: boolean;
};

/**
 * Rank all candidates so a near-tied fourth result cannot evict an incumbent before the
 * UI has a chance to apply stability. Candidate preparation shares the search work budget.
 */
async function rankSuggestions(
  collector: MatchCollector,
  budget: SearchWorkBudget,
  signal: AbortSignal,
): Promise<RankedMatch[]> {
  const candidates: RankedMatch[] = [];
  for (const kind of ['action', 'text'] as const) {
    const matches = kind === 'action' ? collector.actions : collector.matchingText;
    for (const match of matches) {
      candidates.push({
        kind,
        node: match.node,
        score: match.score * (kind === 'action' ? ACTION_PRIORITY_BOOST : 1),
        term: match.term,
        distance: match.distance,
      });
      const pause = budget.checkpoint(signal);
      if (pause) await pause;
    }
  }
  const ranked = await budget.sort(candidates, (left, right) => right.score - left.score, signal);

  // A control with a label is both an action and a text block, so the same node can arrive
  // twice. Showing one node on two rows would waste a place people are meant to aim at.
  const seen = new Set<Element>();
  const distinct: RankedMatch[] = [];
  for (const match of ranked) {
    if (!seen.has(match.node)) {
      seen.add(match.node);
      distinct.push(match);
    }
    const pause = budget.checkpoint(signal);
    if (pause) await pause;
  }
  if (signal.aborted) throw abortError();
  return distinct;
}

function abortError(): Error {
  const error = new Error('Search cancelled');
  error.name = 'AbortError';
  return error;
}

function yieldToMainThread(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      window.clearTimeout(handle);
      reject(abortError());
    };
    const resume = () => {
      signal.removeEventListener('abort', cancel);
      resolve();
    };
    const handle = window.setTimeout(resume, 0);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

class SearchWorkBudget {
  private deadline = performance.now() + SEARCH_WORK_BUDGET_MS;
  private processed = 0;

  checkpoint(signal: AbortSignal): Promise<void> | undefined {
    if (++this.processed % SEARCH_CHUNK_SIZE !== 0 || performance.now() < this.deadline)
      return undefined;
    return yieldToMainThread(signal).then(() => {
      this.deadline = performance.now() + SEARCH_WORK_BUDGET_MS;
    });
  }

  // Collect first, then stable-sort in cancellable chunks. Inserting every match into an
  // unbounded sorted array would make broad searches quadratic.
  async sort<T>(items: T[], compare: (left: T, right: T) => number, signal: AbortSignal) {
    let source = items;
    let target = new Array<T>(items.length);
    for (let width = 1; width < items.length; width *= 2) {
      for (let start = 0; start < items.length; start += width * 2) {
        const middle = Math.min(start + width, items.length);
        const end = Math.min(start + width * 2, items.length);
        let left = start;
        let right = middle;
        for (let output = start; output < end; output++) {
          target[output] =
            left < middle && (right >= end || compare(source[left]!, source[right]!) <= 0)
              ? source[left++]!
              : source[right++]!;
          const pause = this.checkpoint(signal);
          if (pause) await pause;
        }
      }
      [source, target] = [target, source];
    }
    if (signal.aborted) throw abortError();
    return source;
  }
}

class PageSearchIndex {
  readonly root: HTMLElement;
  readonly actionableSelector: string;
  readonly records = new Map<Element, SearchRecord | null>();
  readonly observer: MutationObserver;
  readonly onChange: () => void;
  private readonly lifetime = new AbortController();
  private readonly pendingSubtrees = new Map<Element, number>();
  private subtreeRevision = 0;
  private needsPruning = false;

  constructor(onChange: () => void = () => undefined) {
    this.root = document.body;
    this.actionableSelector = ACTIONABLE_SELECTOR;
    this.onChange = onChange;
    this.handleMutations = this.handleMutations.bind(this);

    this.addSubtree(this.root);
    this.observer = new MutationObserver(this.handleMutations);
    this.observer.observe(document.documentElement, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  isCandidate(node: Node | null): node is Element {
    return (
      node instanceof Element &&
      node.id !== KEYMOVE_ROOT_ID &&
      !DO_NOT_SEARCH_NODE_TYPES.includes(node.nodeName) &&
      (this.hasDirectSearchableText(node) ||
        node.matches(TEXT_BLOCK_SELECTOR) ||
        node.matches(this.actionableSelector))
    );
  }

  hasDirectSearchableText(node: Element) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 0) {
        return true;
      }
    }
    return false;
  }

  addSubtree(root: Node | null) {
    if (!root) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      this.refreshCandidate(root.parentElement);
      return;
    }

    if (!(root instanceof Element)) {
      return;
    }

    this.pendingSubtrees.set(root, ++this.subtreeRevision);
  }

  removeSubtree(root: Node | null) {
    if (!(root instanceof Element)) {
      return;
    }

    this.needsPruning = true;
  }

  refreshCandidate(node: Node | null) {
    if (this.isCandidate(node)) {
      this.records.set(node, null);
    } else if (node instanceof Element) {
      this.records.delete(node);
    }
  }

  invalidateAncestors(node: Node | null) {
    if (!node) {
      return;
    }

    let element = node instanceof Element ? node : node.parentElement;
    while (element && element !== document.body) {
      if (this.records.has(element)) {
        this.records.set(element, null);
      }
      element = element.parentElement;
    }
  }

  invalidateSubtree(root: Node | null) {
    if (!(root instanceof Element)) {
      return;
    }

    this.pendingSubtrees.set(root, ++this.subtreeRevision);
  }

  private async flushPendingSubtrees(signal: AbortSignal, budget: SearchWorkBudget) {
    if (this.needsPruning) {
      this.needsPruning = false;
      try {
        for (const node of this.records.keys()) {
          if (!this.root.contains(node)) this.records.delete(node);
          const pause = budget.checkpoint(signal);
          if (pause) await pause;
        }
      } catch (error) {
        this.needsPruning = true;
        throw error;
      }
    }
    for (const [root, revision] of this.pendingSubtrees) {
      if (!this.root.contains(root)) {
        this.pendingSubtrees.delete(root);
        continue;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
        acceptNode: node =>
          node instanceof Element &&
          (node.id === KEYMOVE_ROOT_ID || DO_NOT_SEARCH_NODE_TYPES.includes(node.nodeName))
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      });
      let node: Node | null = root;
      do {
        if (signal.aborted) throw abortError();
        this.refreshCandidate(node);
        const pause = budget.checkpoint(signal);
        if (pause) await pause;
        node = walker.nextNode();
      } while (node);
      if (this.pendingSubtrees.get(root) === revision) this.pendingSubtrees.delete(root);
    }
  }

  handleMutations(mutations: MutationRecord[]) {
    // A queued observer callback can outlive its DOM realm during teardown.
    if (typeof Element === 'undefined' || this.lifetime.signal.aborted) {
      return;
    }

    const pageMutations = mutations.filter(mutation => {
      const target =
        mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (target?.closest(`#${KEYMOVE_ROOT_ID}`)) {
        return false;
      }
      return (
        mutation.type !== 'childList' ||
        [...mutation.addedNodes, ...mutation.removedNodes].some(
          node => !(node instanceof Element) || node.id !== KEYMOVE_ROOT_ID,
        )
      );
    });
    if (pageMutations.length === 0) {
      return;
    }

    pageMutations.forEach(mutation => {
      if (!this.root.contains(mutation.target)) {
        return;
      }
      if (mutation.type === 'childList') {
        mutation.removedNodes.forEach(node => this.removeSubtree(node));
        mutation.addedNodes.forEach(node => this.addSubtree(node));
        this.refreshCandidate(mutation.target);
      } else if (mutation.type === 'attributes') {
        // Visibility is evaluated during each search, so attribute changes only invalidate
        // the changed element.
        this.refreshCandidate(mutation.target);
      } else if (mutation.type === 'characterData') {
        this.refreshCandidate(mutation.target.parentElement);
      }

      this.invalidateAncestors(mutation.target);
    });
    this.onChange();
  }

  recordForNode(node: Element): SearchRecord {
    const cachedRecord = this.records.get(node);
    if (cachedRecord) {
      return cachedRecord;
    }

    const record = {
      attributeValues: searchableAttributeValuesForNode(node),
    };
    this.records.set(node, record);
    return record;
  }

  isVisible(node: Element, styles: StyleCache = new WeakMap()) {
    if (
      !node.isConnected ||
      !(
        (node instanceof HTMLElement && (node.offsetWidth || node.offsetHeight)) ||
        node.getClientRects().length
      )
    ) {
      return false;
    }

    return isTextVisible(node, styles);
  }

  textContainerForNode(node: Element) {
    return node.closest(TEXT_BLOCK_SELECTOR) ?? node;
  }

  actionableAncestorForNode(node: Element): HTMLElement | null {
    let candidate: Element | null = node;
    while (candidate && candidate !== document.body) {
      if (candidate instanceof HTMLElement && isLinkOrButtonOrInput(candidate)) {
        return candidate;
      }
      candidate = candidate.parentElement;
    }
    return null;
  }

  async search(nodeScorer: NodeScorer, { signal }: SearchOptions = {}): Promise<SearchResult> {
    if (signal?.aborted || this.lifetime.signal.aborted) throw abortError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    this.lifetime.signal.addEventListener('abort', abort, { once: true });
    try {
      return await this.searchWithSignal(nodeScorer, controller.signal);
    } finally {
      signal?.removeEventListener('abort', abort);
      this.lifetime.signal.removeEventListener('abort', abort);
    }
  }

  private async searchWithSignal(
    nodeScorer: NodeScorer,
    searchSignal: AbortSignal,
  ): Promise<SearchResult> {
    const budget = new SearchWorkBudget();
    await this.flushPendingSubtrees(searchSignal, budget);
    const collector: MatchCollector = {
      actions: [],
      matchingText: [],
      textMatchesByContainer: new Map(),
    };
    const styles: StyleCache = new WeakMap();
    // Only retained when a fuzzy pass could follow, since it holds the visible text of the
    // whole page. Re-deriving that text is the expensive half of a search, not comparing it.
    const rescorable = nodeScorer.supportsFuzzy();
    const scanned: ScannedNode[] = [];
    for (const node of this.records.keys()) {
      if (searchSignal.aborted) throw abortError();
      const pause = budget.checkpoint(searchSignal);
      if (pause) await pause;
      if (searchSignal.aborted) throw abortError();
      if (!this.root.contains(node)) {
        this.records.delete(node);
        continue;
      }

      if (!this.isVisible(node, styles)) {
        continue;
      }

      const record = this.recordForNode(node);
      // Visibility can change through ancestor styles without changing this node's text.
      const textParts: string[] = [];
      for (const text of iterateVisibleTextNodes(node, styles)) {
        textParts.push(text.data);
        const pause = budget.checkpoint(searchSignal);
        if (pause) await pause;
      }
      const innerText = textParts
        .join('')
        .toLocaleLowerCase()
        .trim()
        .replace(NO_BREAK_SPACE_REGEX, ' ');
      if (rescorable && (innerText.length > 0 || record.attributeValues.length > 0)) {
        scanned.push({ node, innerText, attributeValues: record.attributeValues });
      }
      const score = nodeScorer.score(node, innerText, record.attributeValues);
      const textTerm =
        score > 0 && nodeScorer.textMatchesWithValue(innerText) ? nodeScorer.queryText : null;
      this.collectScoredNode(node, score, textTerm, null, collector);
    }

    const isFuzzy =
      rescorable && collector.matchingText.length === 0 && collector.actions.length === 0;
    if (isFuzzy) {
      await this.rescoreFuzzily(scanned, nodeScorer, collector, searchSignal, budget);
    }
    collector.actions = await budget.sort(
      collector.actions,
      (left, right) => right.score - left.score,
      searchSignal,
    );
    collector.matchingText = await budget.sort(
      collector.matchingText,
      (left, right) => {
        const position = left.node.compareDocumentPosition(right.node);
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        return 0;
      },
      searchSignal,
    );
    const { actions, matchingText } = collector;
    for (const match of matchingText) {
      if (match.action) continue;
      const walker = document.createTreeWalker(match.node, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        const pause = budget.checkpoint(searchSignal);
        if (pause) await pause;
        if (
          node instanceof HTMLElement &&
          node.matches(this.actionableSelector) &&
          this.isVisible(node, styles)
        ) {
          match.action = node;
          break;
        }
        node = walker.nextNode();
      }
    }
    if (searchSignal.aborted) throw abortError();

    return {
      matchingText,
      matchingLinksAndButtons: actions.map(match => match.node),
      suggestions:
        nodeScorer.queryText.trim().length >= MIN_SUGGESTION_QUERY_LENGTH
          ? await rankSuggestions(collector, budget, searchSignal)
          : [],
      isFuzzy,
    };
  }

  /**
   * Second scoring pass over the text already gathered, run only when the exact pass found
   * nothing at all. Exact matching is a native substring scan; approximate matching costs
   * far more per node, so it is never paid for a search that already has results to show.
   */
  private async rescoreFuzzily(
    scanned: ScannedNode[],
    nodeScorer: NodeScorer,
    collector: MatchCollector,
    searchSignal: AbortSignal,
    budget: SearchWorkBudget,
  ) {
    for (const entry of scanned) {
      if (searchSignal.aborted) throw abortError();
      const pause = budget.checkpoint(searchSignal);
      if (pause) await pause;
      if (!this.root.contains(entry.node)) continue;
      const { score, textTerm, distance } = nodeScorer.fuzzyScore(
        entry.node,
        entry.innerText,
        entry.attributeValues,
      );
      this.collectScoredNode(entry.node, score, textTerm, distance, collector);
    }
  }

  private collectScoredNode(
    node: Element,
    score: number,
    textTerm: string | null,
    distance: number | null,
    collector: MatchCollector,
  ) {
    if (score <= 0) return;
    const { actions, matchingText, textMatchesByContainer } = collector;
    if (node instanceof HTMLElement && isLinkOrButtonOrInput(node)) {
      actions.push({ node, score, term: textTerm, distance });
    }
    if (textTerm === null) return;
    if (!this.hasDirectSearchableText(node) && !node.matches(TEXT_BLOCK_SELECTOR)) return;
    const textContainer = this.textContainerForNode(node);
    const action = this.actionableAncestorForNode(node);
    const existingMatch = textMatchesByContainer.get(textContainer);
    if (existingMatch) {
      existingMatch.action ??= action;
      return;
    }
    const match = { node: textContainer, action, term: textTerm, score, distance };
    matchingText.push(match);
    textMatchesByContainer.set(textContainer, match);
  }

  disconnect() {
    this.lifetime.abort();
    this.observer.disconnect();
    this.records.clear();
    this.pendingSubtrees.clear();
  }
}

export type { RankedMatch, SearchOptions, SearchResult, TextMatch };
export { PageSearchIndex };
