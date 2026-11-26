import {
  ACTION_PRIORITY_BOOST,
  DO_NOT_SEARCH_NODE_TYPES,
  MIN_SUGGESTION_QUERY_LENGTH,
} from '../constants.js';
import NodeScorer from './node_scorer.js';
import {
  ACTIONABLE_SELECTOR,
  isLinkOrButtonOrInput,
  isActionDisabled,
  labelledToggle,
  searchableAttributeValuesForNode,
} from './searchable_attributes.js';
import {
  computedStyle,
  hasRenderedBox,
  isInlineLevel,
  isTextVisible,
  iterateRenderedText,
} from './visible_text.js';
import { normalizeSearchText } from './search_text.js';
import type { OwnedText, StyleCache } from './visible_text.js';
import { iterateControlName } from './control_name.js';
import { hasSearchableInputValue, inputDisplayValue } from './input_value.js';
import { activeModal, actionIsInScope, MODAL_CHANGED_EVENT } from './modal_context.js';
import { isOwnEvent } from './trusted_input.js';
import {
  containsAcrossRoots,
  isKeyMoveNode,
  isKeyMoveRoot,
  walkOwnedElements,
  walkRenderedElements,
  renderedChildren,
  renderedParent,
  closestAcrossRoots,
  compareRenderedOrder,
  retainPageRoot,
  releasePageRoot,
  PAGE_ROOTS_CHANGED,
} from './dom_tree.js';

const SEARCH_CHUNK_SIZE = 100;
const SEARCH_WORK_BUDGET_MS = 8;
const TEXT_BLOCK_SELECTOR =
  'p, li, blockquote, pre, td, th, dt, dd, figcaption, h1, h2, h3, h4, h5, h6';

// A semantic text block covers everything inside it, including descendants laid out as
// blocks, except a nested semantic block, which is a result of its own.
const isNestedTextBlock = (element: Element) => element.matches(TEXT_BLOCK_SELECTOR);
// Any other element owns its text and inline content, not the boxes laid out inside it.
// Slots only forward assigned content, which their host owns whatever their display.
const isSeparateBlock = (element: Element, display: string) =>
  !(element instanceof HTMLSlotElement) && (!isInlineLevel(display) || isNestedTextBlock(element));

type SearchRecord = {
  attributeValues: string[];
  nameRevision?: number;
  name?: string;
};

type ActionMatch = {
  node: HTMLElement;
  score: number;
  term: string | null;
  distance: number | null;
};
// `term` is a slice of the shared searchable text. Highlighting maps it back to DOM
// boundaries, including collapsed whitespace and structural line breaks.
type TextMatch = {
  node: Element;
  action: HTMLElement | null;
  term: string;
  score: number;
  distance: number | null;
};
// `innerText` is the text the node owns, one entry for each run uninterrupted by a block of
// its own, so no phrase can be matched across a block left out. `actionText` is all of its
// text, which differs only for a node containing such blocks.
type ScannedNode = {
  node: Element;
  innerText: string[];
  actionText: string;
  attributeValues: string[];
};
// `occurrences` is how many times the query appears in the text the node owns. An
// approximate match stands for one, its closest spelling.
type ScoredText = {
  score: number;
  term: string | null;
  distance: number | null;
  occurrences?: number;
};

// Overlapping occurrences each count: "ana" is in "banana" twice.
function countOccurrences(runs: string[], query: string) {
  let count = 0;
  if (!query) return count;
  for (const run of runs) {
    for (let at = run.indexOf(query); at !== -1; at = run.indexOf(query, at + 1)) {
      count += 1;
    }
  }
  return count;
}
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
  styles: StyleCache;
  modal: Element | null;
  actions: ActionMatch[];
  matchingText: TextMatch[];
  textMatchesByContainer: Map<Element, TextMatch>;
  // Matches of left-out blocks with no text node of their own, kept only for a phrase no
  // descendant matches by itself.
  blockMatches: Set<TextMatch>;
  // Occurrences each text result stands for, to tell a repeated block from one holding more.
  occurrences: Map<Element, number>;
  // Text matches of nodes with no text node of their own, held until the scan has found
  // every left-out block, since a block can be scanned before the node that leaves it out.
  deferredText: { node: Element; textMatch: ScoredText }[] | null;
};
type SearchOptions = { signal?: AbortSignal };
type SearchResult = {
  matchingText: TextMatch[];
  matchingLinksAndButtons: HTMLElement[];
  // All distinct candidates in score order. The UI applies stability before choosing the configured count.
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
  private readonly pendingSubtrees = new Map<Element | ShadowRoot, number>();
  private readonly shadowObservers = new Map<ShadowRoot, MutationObserver>();
  private readonly handledControlEvents = new WeakSet<Event>();
  // Blocks some candidate's owned text left out. They own their inline text even without
  // a text node of their own, so they can be text results.
  private ownedBlocks = new WeakSet<Element>();
  // The block, if any, each inline ancestor's text belongs to, for the current search.
  private ownerBlocks = new WeakMap<Element, Element | null>();
  // Left-out blocks indexed only for that reason, not as candidates in their own right.
  private readonly lazyBlocks = new Set<Element>();
  private subtreeRevision = 0;
  private needsPruning = false;
  private nameRevision = 0;

  constructor(onChange: () => void = () => undefined) {
    this.root = document.body;
    this.actionableSelector = ACTIONABLE_SELECTOR;
    this.onChange = onChange;
    document.addEventListener(MODAL_CHANGED_EVENT, this.handleModalChange);
    document.addEventListener('input', this.handleControlChange, true);
    document.addEventListener('change', this.handleControlChange, true);
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

  // Page script can dispatch this notification too; only KeyMove's own counts.
  private readonly handleModalChange = (event: Event) => {
    if (isOwnEvent(event)) this.onChange();
  };

  private readonly handleControlChange = (event: Event) => {
    if (this.handledControlEvents.has(event)) return;
    const node = event.composedPath()[0] ?? event.target;
    if (
      !(node instanceof Element) ||
      !(
        hasSearchableInputValue(node) ||
        (node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type))
      ) ||
      isKeyMoveNode(node) ||
      !containsAcrossRoots(this.root, node)
    )
      return;
    this.handledControlEvents.add(event);
    this.onChange();
  };

  private readonly handleSlotChange = () => {
    this.nameRevision++;
    this.onChange();
  };

  private async discoverRoots(signal: AbortSignal, budget: SearchWorkBudget) {
    let changed = false;
    try {
      for (const [root, observer] of this.shadowObservers) {
        if (containsAcrossRoots(this.root, root) && !isKeyMoveNode(root)) continue;
        observer.disconnect();
        this.removeRootListeners(root);
        releasePageRoot(root);
        this.shadowObservers.delete(root);
        changed = true;
      }
      // attachShadow itself emits no MutationRecord. A fresh query also discovers roots
      // attached later to already-connected hosts, without patching the page's prototypes.
      for (const node of walkOwnedElements(this.root)) {
        if (signal.aborted) throw abortError();
        if (!this.records.has(node)) this.refreshCandidate(node);
        const root = node.shadowRoot;
        if (root && !this.shadowObservers.has(root)) {
          const observer = new MutationObserver(this.handleMutations);
          observer.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          root.addEventListener('input', this.handleControlChange, true);
          root.addEventListener('change', this.handleControlChange, true);
          root.addEventListener('slotchange', this.handleSlotChange);
          this.shadowObservers.set(root, observer);
          retainPageRoot(root);
          this.addSubtree(root);
          changed = true;
        }
        const pause = budget.checkpoint(signal);
        if (pause) await pause;
      }
    } finally {
      if (changed) document.dispatchEvent(new Event(PAGE_ROOTS_CHANGED));
    }
  }

  private removeRootListeners(root: ShadowRoot) {
    root.removeEventListener('input', this.handleControlChange, true);
    root.removeEventListener('change', this.handleControlChange, true);
    root.removeEventListener('slotchange', this.handleSlotChange);
  }

  isCandidate(node: Node | null): node is Element {
    return (
      node instanceof Element &&
      !isKeyMoveRoot(node) &&
      !DO_NOT_SEARCH_NODE_TYPES.includes(node.nodeName) &&
      (this.hasDirectSearchableText(node) ||
        node.matches(TEXT_BLOCK_SELECTOR) ||
        node.matches(this.actionableSelector))
    );
  }

  hasDirectSearchableText(node: Element) {
    if (node instanceof HTMLSlotElement) return false;
    const pending: Iterator<Node>[] = [renderedChildren(node)];
    while (pending.length) {
      const step = pending[pending.length - 1]!.next();
      if (step.done) {
        pending.pop();
        continue;
      }
      const child = step.value;
      if (child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 0) {
        return true;
      }
      if (child instanceof HTMLSlotElement) pending.push(renderedChildren(child));
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

    if (!(root instanceof Element || root instanceof ShadowRoot)) {
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
      this.lazyBlocks.delete(node);
    } else if (node instanceof Element) {
      this.records.delete(node);
      this.ownedBlocks.delete(node);
      this.lazyBlocks.delete(node);
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

  private async flushPendingSubtrees(signal: AbortSignal, budget: SearchWorkBudget) {
    if (this.needsPruning) {
      this.needsPruning = false;
      try {
        for (const node of this.records.keys()) {
          if (!containsAcrossRoots(this.root, node) || isKeyMoveNode(node))
            this.records.delete(node);
          const pause = budget.checkpoint(signal);
          if (pause) await pause;
        }
      } catch (error) {
        this.needsPruning = true;
        throw error;
      }
    }
    for (const [root, revision] of this.pendingSubtrees) {
      if (!containsAcrossRoots(this.root, root) || isKeyMoveNode(root)) {
        this.pendingSubtrees.delete(root);
        continue;
      }
      // Discovery queues each new shadow root separately. Stay in this owning tree
      // so nested roots are not indexed again for every ancestor in the queue.
      for (const node of walkOwnedElements(root, { enterShadowRoots: false })) {
        if (signal.aborted) throw abortError();
        this.refreshCandidate(node);
        const pause = budget.checkpoint(signal);
        if (pause) await pause;
      }
      if (this.pendingSubtrees.get(root) === revision) this.pendingSubtrees.delete(root);
    }
  }

  handleMutations(mutations: MutationRecord[]) {
    // A queued observer callback can outlive its DOM realm during teardown.
    if (typeof Element === 'undefined' || this.lifetime.signal.aborted) {
      return;
    }

    const pageMutations = mutations.filter(mutation => {
      if (isKeyMoveNode(mutation.target)) {
        return false;
      }
      return (
        mutation.type !== 'childList' ||
        [...mutation.addedNodes, ...mutation.removedNodes].some(node => !isKeyMoveRoot(node))
      );
    });
    if (pageMutations.length === 0) {
      return;
    }
    // A referenced label can live anywhere, including outside the indexed body.
    this.nameRevision++;

    pageMutations.forEach(mutation => {
      if (!containsAcrossRoots(this.root, mutation.target)) {
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
    // Only actions are measured by their contents when display: contents gives them no
    // box: text in such a wrapper already belongs to the block around it.
    if (!node.isConnected || !hasRenderedBox(node, styles, isLinkOrButtonOrInput(node))) {
      return false;
    }

    return isTextVisible(node, styles);
  }

  textContainerForNode(node: Element) {
    return closestAcrossRoots(node, TEXT_BLOCK_SELECTOR) ?? node;
  }

  actionableAncestorForNode(node: Element, modal: Element | null): HTMLElement | null {
    let candidate: Element | null = node;
    while (candidate && candidate !== document.body) {
      if (
        candidate instanceof HTMLElement &&
        isLinkOrButtonOrInput(candidate) &&
        actionIsInScope(candidate, modal) &&
        !isActionDisabled(candidate)
      ) {
        return candidate;
      }
      candidate = renderedParent(candidate);
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
    await this.discoverRoots(searchSignal, budget);
    await this.flushPendingSubtrees(searchSignal, budget);
    // Left-out blocks are found again by the candidates that leave them out, so results
    // depend only on the page as it is now, never on what an earlier search came across.
    for (const block of this.lazyBlocks) this.records.delete(block);
    this.lazyBlocks.clear();
    this.ownedBlocks = new WeakSet();
    this.ownerBlocks = new WeakMap();
    const collector: MatchCollector = {
      styles: new WeakMap(),
      modal: activeModal(),
      actions: [],
      matchingText: [],
      textMatchesByContainer: new Map(),
      blockMatches: new Set(),
      occurrences: new Map(),
      deferredText: [],
    };
    const styles = collector.styles;
    // Only retained when a fuzzy pass could follow, since it holds the visible text of the
    // whole page. Re-deriving that text is the expensive half of a search, not comparing it.
    const rescorable = nodeScorer.supportsFuzzy();
    const scanned: ScannedNode[] = [];
    for (const node of this.records.keys()) {
      if (searchSignal.aborted) throw abortError();
      const pause = budget.checkpoint(searchSignal);
      if (pause) await pause;
      if (searchSignal.aborted) throw abortError();
      if (!containsAcrossRoots(this.root, node) || isKeyMoveNode(node)) {
        this.records.delete(node);
        continue;
      }

      if (this.lazyBlocks.has(node)) {
        await this.scanLazyBlock(node, nodeScorer, collector, scanned, budget, searchSignal);
        continue;
      }

      if (!actionIsInScope(node, collector.modal)) continue;
      // Before the visibility check: a display: contents element has no box of its own,
      // yet its text is visible through the block it belongs to.
      const owner = this.uncoveredOwnerBlock(node, styles);
      if (owner) this.queueSkippedBlocks({ skipped: [owner], boundary: isSeparateBlock });
      if (!this.isVisible(node, styles)) continue;

      const record = this.recordForNode(node);
      if (isLinkOrButtonOrInput(node) && record.nameRevision !== this.nameRevision) {
        const revision = this.nameRevision;
        const parts: string[] = [];
        for (const part of iterateControlName(node)) {
          if (part) parts.push(part);
          const pause = budget.checkpoint(searchSignal);
          if (pause) await pause;
        }
        record.name = normalizeSearchText(parts.join('').replace(/\s+/g, ' ')).trim();
        record.nameRevision = revision;
      }
      const attributeValues = record.name
        ? [...record.attributeValues, record.name]
        : [...record.attributeValues];
      const value = inputDisplayValue(node);
      if (value) attributeValues.push(normalizeSearchText(value));
      // Visibility can change through ancestor styles without changing this node's text.
      // A text result is decided by the text the node owns, so a wrapper is not a result
      // merely because blocks nested inside it match. Those blocks are candidates themselves.
      const owned: OwnedText = {
        skipped: [],
        boundary: node.matches(TEXT_BLOCK_SELECTOR) ? isNestedTextBlock : isSeparateBlock,
      };
      const innerText = await this.readOwnedText(node, styles, budget, searchSignal, owned);
      // A left-out block is searched by itself, including one with no text node of its
      // own whose inline children cannot match a phrase separately. The record map's
      // iteration reaches entries added during it.
      this.queueSkippedBlocks(owned);
      // An action is still named by everything it contains, such as a card link's blocks.
      const actionText =
        isLinkOrButtonOrInput(node) && owned.skipped.length > 0
          ? await this.readText(node, styles, budget, searchSignal)
          : (innerText[0] ?? '');
      if (rescorable && (innerText.length > 0 || actionText || attributeValues.length > 0)) {
        scanned.push({ node, innerText, actionText, attributeValues });
      }
      const matchingRun = innerText.find(run => nodeScorer.textMatchesWithValue(run));
      const textScore =
        matchingRun === undefined ? 0 : nodeScorer.score(node, matchingRun, attributeValues);
      const actionMatches = nodeScorer.textMatchesWithValue(actionText);
      const actionScore =
        actionMatches && actionText === matchingRun
          ? textScore
          : nodeScorer.score(node, actionText, attributeValues);
      this.collectScoredNode(
        node,
        { score: actionScore, term: actionMatches ? nodeScorer.queryText : null, distance: null },
        {
          score: textScore,
          term: matchingRun === undefined ? null : nodeScorer.queryText,
          distance: null,
          occurrences: countOccurrences(innerText, nodeScorer.queryText),
        },
        collector,
      );
    }

    const deferredText = collector.deferredText ?? [];
    collector.deferredText = null;
    for (const { node, textMatch } of deferredText) {
      if (searchSignal.aborted) throw abortError();
      const pause = budget.checkpoint(searchSignal);
      if (pause) await pause;
      if (searchSignal.aborted) throw abortError();
      this.collectTextMatch(node, textMatch, collector);
    }
    const isFuzzy =
      rescorable && collector.matchingText.length === 0 && collector.actions.length === 0;
    if (isFuzzy) {
      await this.rescoreFuzzily(scanned, nodeScorer, collector, searchSignal, budget);
    }
    await this.dropRedundantBlockMatches(collector, budget, searchSignal);
    collector.actions = await budget.sort(
      collector.actions,
      (left, right) => right.score - left.score,
      searchSignal,
    );
    collector.matchingText = await budget.sort(
      collector.matchingText,
      (left, right) => {
        return compareRenderedOrder(left.node, right.node);
      },
      searchSignal,
    );
    const { actions, matchingText } = collector;
    for (const match of matchingText) {
      if (match.action) continue;
      for (const node of walkRenderedElements(match.node)) {
        if (node === match.node) continue;
        const pause = budget.checkpoint(searchSignal);
        if (pause) await pause;
        if (
          node instanceof HTMLElement &&
          isLinkOrButtonOrInput(node) &&
          actionIsInScope(node, collector.modal) &&
          !isActionDisabled(node) &&
          this.isVisible(node, styles) &&
          !this.inSeparateBox(node, match.node, styles)
        ) {
          match.action = node;
          break;
        }
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
      if (!containsAcrossRoots(this.root, entry.node)) continue;
      let text = nodeScorer.fuzzyScore(entry.node, '', entry.attributeValues);
      for (const run of entry.innerText) {
        const candidate = nodeScorer.fuzzyScore(entry.node, run, entry.attributeValues);
        if (candidate.textTerm !== null && (text.textTerm === null || candidate.score > text.score))
          text = candidate;
      }
      const action =
        entry.innerText.length === 1 && entry.actionText === entry.innerText[0]
          ? text
          : nodeScorer.fuzzyScore(entry.node, entry.actionText, entry.attributeValues);
      this.collectScoredNode(
        entry.node,
        { score: action.score, term: action.textTerm, distance: action.distance },
        { score: text.score, term: text.textTerm, distance: text.distance },
        collector,
      );
    }
  }

  private async readText(
    node: Element,
    styles: StyleCache,
    budget: SearchWorkBudget,
    signal: AbortSignal,
  ) {
    const parts: string[] = [];
    for (const part of iterateRenderedText(node, styles)) {
      if (part) parts.push(part.searchText);
      const pause = budget.checkpoint(signal);
      if (pause) await pause;
    }
    return normalizeSearchText(parts.join('')).trim();
  }

  private queueSkippedBlocks(owned: OwnedText) {
    for (const block of owned.skipped) {
      this.ownedBlocks.add(block);
      if (this.records.has(block)) continue;
      this.records.set(block, null);
      this.lazyBlocks.add(block);
    }
  }

  /**
   * Whether an action inside a text result sits in a box the result does not own. Any
   * element other than a semantic block owns its text and inline content, not the boxes
   * laid out inside it, so an action in one of those is not the result's action.
   */
  private inSeparateBox(action: Element, result: Element, styles: StyleCache) {
    if (result.matches(TEXT_BLOCK_SELECTOR)) return false;
    for (let node: Element | null = action; node && node !== result; node = renderedParent(node)) {
      if (isSeparateBlock(node, computedStyle(node, styles).display)) return true;
    }
    return false;
  }

  /**
   * The block an inline candidate's text belongs to, when no candidate holds that block.
   * A block whose inline children carry all of its text has no text node of its own, so
   * it is not a candidate, and a phrase spread over those children matches only there.
   * Blocks that a candidate leaves out are queued by that candidate instead.
   */
  private uncoveredOwnerBlock(node: Element, styles: StyleCache) {
    // Controls are results of their own; adjacent ones run together in a block's text.
    if (
      node.matches(TEXT_BLOCK_SELECTOR) ||
      isLinkOrButtonOrInput(node) ||
      !isInlineLevel(computedStyle(node, styles).display)
    )
      return null;
    // Inline siblings share their ancestors, so each ancestor is resolved once a search.
    const visited: Element[] = [];
    let owner: Element | null = null;
    for (let parent = renderedParent(node); parent; parent = renderedParent(parent)) {
      const known = this.ownerBlocks.get(parent);
      if (known !== undefined) {
        owner = known;
        break;
      }
      visited.push(parent);
      const display = computedStyle(parent, styles).display;
      // A record holds this text, unless it has no box and so is never scanned itself.
      if (this.records.has(parent) && display !== 'contents') break;
      if (isSeparateBlock(parent, display)) {
        // Selecting the page's root would take in the whole page and its actions.
        const isRoot =
          parent === this.root ||
          parent === document.body ||
          parent === document.documentElement ||
          isKeyMoveRoot(parent);
        if (!isRoot) owner = parent;
        break;
      }
    }
    for (const element of visited) this.ownerBlocks.set(element, owner);
    return owner;
  }

  /**
   * A block queued only because a candidate left it out is neither an action nor a
   * semantic block, so only its owned text matters. Most such blocks own none, being
   * containers of other blocks, and are passed over before any per-node lookups.
   */
  private async scanLazyBlock(
    node: Element,
    nodeScorer: NodeScorer,
    collector: MatchCollector,
    scanned: ScannedNode[],
    budget: SearchWorkBudget,
    signal: AbortSignal,
  ) {
    const { styles } = collector;
    if (!actionIsInScope(node, collector.modal)) return;
    const owned: OwnedText = { skipped: [], boundary: isSeparateBlock };
    const innerText = await this.readOwnedText(node, styles, budget, signal, owned);
    this.queueSkippedBlocks(owned);
    if (innerText.length === 0 || !this.isVisible(node, styles)) return;
    if (nodeScorer.supportsFuzzy())
      scanned.push({ node, innerText, actionText: '', attributeValues: [] });
    const matchingRun = innerText.find(run => nodeScorer.textMatchesWithValue(run));
    if (matchingRun === undefined) return;
    this.collectScoredNode(
      node,
      { score: 0, term: null, distance: null },
      {
        score: nodeScorer.score(node, matchingRun, []),
        term: nodeScorer.queryText,
        distance: null,
        occurrences: countOccurrences(innerText, nodeScorer.queryText),
      },
      collector,
    );
  }

  private async readOwnedText(
    node: Element,
    styles: StyleCache,
    budget: SearchWorkBudget,
    signal: AbortSignal,
    owned: OwnedText,
  ) {
    const runs: string[] = [];
    let parts: string[] = [];
    let interruptions = 0;
    const finishRun = () => {
      const run = normalizeSearchText(parts.join('')).trim();
      if (run) runs.push(run);
      parts = [];
    };
    for (const part of iterateRenderedText(node, styles, { ownedOnly: owned })) {
      if (owned.skipped.length !== interruptions) {
        interruptions = owned.skipped.length;
        finishRun();
      }
      if (part) parts.push(part.searchText);
      const pause = budget.checkpoint(signal);
      if (pause) await pause;
    }
    finishRun();
    return runs;
  }

  private collectScoredNode(
    node: Element,
    actionMatch: ScoredText,
    textMatch: ScoredText,
    collector: MatchCollector,
  ) {
    const { actions } = collector;
    const labelledControl = labelledToggle(node);
    if (
      actionMatch.score > 0 &&
      node instanceof HTMLElement &&
      isLinkOrButtonOrInput(node) &&
      actionIsInScope(node, collector.modal) &&
      // A visible native input is already an action; its label must not duplicate it.
      (!labelledControl || !this.isVisible(labelledControl, collector.styles))
    ) {
      actions.push({
        node,
        score: actionMatch.score,
        term: actionMatch.term,
        distance: actionMatch.distance,
      });
    }
    this.collectTextMatch(node, textMatch, collector);
  }

  private collectTextMatch(node: Element, textMatch: ScoredText, collector: MatchCollector) {
    const { matchingText, textMatchesByContainer } = collector;
    const { score, term: textTerm, distance } = textMatch;
    if (score <= 0 || textTerm === null) return;
    const ownsText = this.hasDirectSearchableText(node) || node.matches(TEXT_BLOCK_SELECTOR);
    if (!ownsText) {
      if (collector.deferredText) {
        collector.deferredText.push({ node, textMatch });
        return;
      }
      if (!this.ownedBlocks.has(node) || isInlineLevel(window.getComputedStyle(node).display))
        return;
    }
    const container = this.textContainerForNode(node);
    const textContainer = actionIsInScope(container, collector.modal) ? container : node;
    const action = this.actionableAncestorForNode(node, collector.modal);
    const existingMatch = textMatchesByContainer.get(textContainer);
    if (existingMatch) {
      existingMatch.action ??= action;
      return;
    }
    const match = { node: textContainer, action, term: textTerm, score, distance };
    matchingText.push(match);
    textMatchesByContainer.set(textContainer, match);
    if (textContainer === node) collector.occurrences.set(node, textMatch.occurrences ?? 1);
    if (!ownsText && textContainer === node) collector.blockMatches.add(match);
  }

  /**
   * A left-out block with no text node of its own matches through its inline children,
   * which may be results themselves. The block is dropped only when those results account
   * for every occurrence in its text; a phrase spread over several children, or a further
   * occurrence none of them holds, is reachable through the block alone.
   */
  private async dropRedundantBlockMatches(
    collector: MatchCollector,
    budget: SearchWorkBudget,
    signal: AbortSignal,
  ) {
    const { blockMatches, occurrences, textMatchesByContainer } = collector;
    if (blockMatches.size === 0) return;
    const blocks = new Map([...blockMatches].map(match => [match.node, match]));
    const covered = new Map<TextMatch, number>();
    const startsOwnBlock = (element: Element) =>
      isSeparateBlock(element, computedStyle(element, collector.styles).display);
    for (const match of collector.matchingText) {
      // Text inside a block of its own belongs to no block above it.
      for (
        let node: Element | null = match.node;
        node && node !== document.body && !startsOwnBlock(node);
        node = renderedParent(node)
      ) {
        const pause = budget.checkpoint(signal);
        if (pause) await pause;
        const parent = renderedParent(node);
        if (!parent) break;
        const block = blocks.get(parent);
        if (block) {
          covered.set(block, (covered.get(block) ?? 0) + (occurrences.get(match.node) ?? 1));
          break;
        }
        // An inline result in between already counts this text as part of its own.
        if (textMatchesByContainer.has(parent)) break;
      }
    }
    const redundant = new Set<TextMatch>();
    for (const [block, count] of covered) {
      if (count >= (occurrences.get(block.node) ?? 1)) redundant.add(block);
    }
    if (redundant.size === 0) return;
    collector.matchingText = collector.matchingText.filter(match => !redundant.has(match));
    for (const match of redundant) textMatchesByContainer.delete(match.node);
  }

  disconnect() {
    document.removeEventListener(MODAL_CHANGED_EVENT, this.handleModalChange);
    document.removeEventListener('input', this.handleControlChange, true);
    document.removeEventListener('change', this.handleControlChange, true);
    this.lifetime.abort();
    this.observer.disconnect();
    for (const [root, observer] of this.shadowObservers) {
      observer.disconnect();
      this.removeRootListeners(root);
      releasePageRoot(root);
    }
    this.shadowObservers.clear();
    document.dispatchEvent(new Event(PAGE_ROOTS_CHANGED));
    this.records.clear();
    this.pendingSubtrees.clear();
    this.lazyBlocks.clear();
  }
}

export type { RankedMatch, SearchOptions, SearchResult, TextMatch };
export { PageSearchIndex };
