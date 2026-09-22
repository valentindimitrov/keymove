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
  isActionDisabled,
  labelledToggle,
  searchableAttributeValuesForNode,
} from './searchable_attributes.js';
import { isTextVisible, iterateRenderedText } from './visible_text.js';
import { normalizeSearchText } from './search_text.js';
import type { StyleCache } from './visible_text.js';
import { iterateControlName } from './control_name.js';
import { hasSearchableInputValue, inputDisplayValue } from './input_value.js';
import { activeModal, actionIsInScope, MODAL_CHANGED_EVENT } from './modal_context.js';
import {
  containsAcrossRoots,
  isKeyMoveNode,
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
  styles: StyleCache;
  modal: Element | null;
  actions: ActionMatch[];
  matchingText: TextMatch[];
  textMatchesByContainer: Map<Element, TextMatch>;
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
  private subtreeRevision = 0;
  private needsPruning = false;
  private nameRevision = 0;

  constructor(onChange: () => void = () => undefined) {
    this.root = document.body;
    this.actionableSelector = ACTIONABLE_SELECTOR;
    this.onChange = onChange;
    document.addEventListener(MODAL_CHANGED_EVENT, this.onChange);
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
      node.id !== KEYMOVE_ROOT_ID &&
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
        [...mutation.addedNodes, ...mutation.removedNodes].some(
          node => !(node instanceof Element) || node.id !== KEYMOVE_ROOT_ID,
        )
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
    const collector: MatchCollector = {
      styles: new WeakMap(),
      modal: activeModal(),
      actions: [],
      matchingText: [],
      textMatchesByContainer: new Map(),
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

      if (!actionIsInScope(node, collector.modal) || !this.isVisible(node, styles)) {
        continue;
      }

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
      const textParts: string[] = [];
      for (const part of iterateRenderedText(node, styles)) {
        if (part) textParts.push(part.searchText);
        const pause = budget.checkpoint(searchSignal);
        if (pause) await pause;
      }
      const innerText = normalizeSearchText(textParts.join('')).trim();
      if (rescorable && (innerText.length > 0 || attributeValues.length > 0)) {
        scanned.push({ node, innerText, attributeValues });
      }
      const score = nodeScorer.score(node, innerText, attributeValues);
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
          this.isVisible(node, styles)
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
    const labelledControl = labelledToggle(node);
    if (
      node instanceof HTMLElement &&
      isLinkOrButtonOrInput(node) &&
      actionIsInScope(node, collector.modal) &&
      // A visible native input is already an action; its label must not duplicate it.
      (!labelledControl || !this.isVisible(labelledControl, collector.styles))
    ) {
      actions.push({ node, score, term: textTerm, distance });
    }
    if (textTerm === null) return;
    if (!this.hasDirectSearchableText(node) && !node.matches(TEXT_BLOCK_SELECTOR)) return;
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
  }

  disconnect() {
    document.removeEventListener(MODAL_CHANGED_EVENT, this.onChange);
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
  }
}

export type { RankedMatch, SearchOptions, SearchResult, TextMatch };
export { PageSearchIndex };
