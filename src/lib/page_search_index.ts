import { DO_NOT_SEARCH_NODE_TYPES, KEYMOVE_ROOT_ID } from '../constants.js';
import NodeScorer from './node_scorer.js';
import SearchableAttributeSettings from './searchable_attribute_settings.js';
import { isTextVisible, iterateVisibleTextNodes } from './visible_text.js';
import type { StyleCache } from './visible_text.js';

const DEFAULT_RESULT_LIMIT = 50;
const SEARCH_CHUNK_SIZE = 100;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;
const TEXT_BLOCK_SELECTOR =
  'p, li, blockquote, pre, td, th, dt, dd, figcaption, h1, h2, h3, h4, h5, h6';

type SearchRecord = {
  attributeValues: string[];
};

type ActionMatch = { node: HTMLElement; score: number };
type TextMatch = { node: Element; action: HTMLElement | null };
type SearchOptions = { signal?: AbortSignal; limit?: number };
type SearchResult = {
  matchingText: TextMatch[];
  matchingLinksAndButtons: HTMLElement[];
};

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
    const useIdleCallback = typeof window.requestIdleCallback === 'function';
    const cancel = () => {
      if (useIdleCallback) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      reject(abortError());
    };
    const resume = () => {
      signal.removeEventListener('abort', cancel);
      resolve();
    };
    const handle = useIdleCallback
      ? window.requestIdleCallback(resume, { timeout: 16 })
      : window.setTimeout(resume, 0);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

class PageSearchIndex {
  readonly root: HTMLElement;
  readonly searchableAttributeSettings: SearchableAttributeSettings;
  readonly actionableSelector: string;
  readonly additionalSelectors: string[];
  readonly records = new Map<Element, SearchRecord | null>();
  readonly observer: MutationObserver;
  readonly onChange: () => void;
  private readonly lifetime = new AbortController();
  private readonly pendingSubtrees = new Map<Element, number>();
  private subtreeRevision = 0;
  private needsPruning = false;

  constructor(
    searchableAttributeSettings: SearchableAttributeSettings,
    additionalSelectors: string[] = [],
    onChange: () => void = () => undefined,
  ) {
    this.root = document.body;
    this.searchableAttributeSettings = searchableAttributeSettings;
    this.actionableSelector =
      searchableAttributeSettings.searchableAttributeSettingsByNodeNameToQuerySelector();
    this.additionalSelectors = additionalSelectors;
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
        node.matches(this.actionableSelector) ||
        this.additionalSelectors.some(selector => node.matches(selector)))
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

  private async flushPendingSubtrees(signal: AbortSignal) {
    let processed = 0;
    if (this.needsPruning) {
      this.needsPruning = false;
      try {
        for (const node of this.records.keys()) {
          if (!this.root.contains(node)) this.records.delete(node);
          if (++processed % SEARCH_CHUNK_SIZE === 0) await yieldToMainThread(signal);
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
        if (++processed % SEARCH_CHUNK_SIZE === 0) await yieldToMainThread(signal);
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
        // Visibility is evaluated during each search, so ordinary attribute changes only
        // invalidate the changed element. App-specific selectors may depend on ancestors.
        if (
          this.additionalSelectors.length > 0 ||
          this.searchableAttributeSettings.additionalButtonSelectors.length > 0
        ) {
          this.invalidateSubtree(mutation.target);
        } else {
          this.refreshCandidate(mutation.target);
        }
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
      attributeValues: this.searchableAttributeSettings.searchableAttributeValuesForNode(node),
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
      if (
        candidate instanceof HTMLElement &&
        this.searchableAttributeSettings.isLinkOrButtonOrInput(candidate)
      ) {
        return candidate;
      }
      candidate = candidate.parentElement;
    }
    return null;
  }

  async search(
    nodeScorer: NodeScorer,
    { signal, limit = DEFAULT_RESULT_LIMIT }: SearchOptions = {},
  ): Promise<SearchResult> {
    if (signal?.aborted || this.lifetime.signal.aborted) throw abortError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    this.lifetime.signal.addEventListener('abort', abort, { once: true });
    try {
      return await this.searchWithSignal(nodeScorer, controller.signal, limit);
    } finally {
      signal?.removeEventListener('abort', abort);
      this.lifetime.signal.removeEventListener('abort', abort);
    }
  }

  private async searchWithSignal(
    nodeScorer: NodeScorer,
    searchSignal: AbortSignal,
    limit: number,
  ): Promise<SearchResult> {
    const resultLimit = Number.isFinite(limit)
      ? Math.max(0, Math.floor(limit))
      : DEFAULT_RESULT_LIMIT;
    if (resultLimit === 0) return { matchingText: [], matchingLinksAndButtons: [] };
    await this.flushPendingSubtrees(searchSignal);
    const actions: ActionMatch[] = [];
    const textMatchesByContainer = new Map<Element, TextMatch>();
    const matchingText: TextMatch[] = [];
    const styles: StyleCache = new WeakMap();
    let processed = 0;
    for (const node of this.records.keys()) {
      if (searchSignal.aborted) throw abortError();
      if (++processed % SEARCH_CHUNK_SIZE === 0) await yieldToMainThread(searchSignal);
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
        if (++processed % SEARCH_CHUNK_SIZE === 0) await yieldToMainThread(searchSignal);
      }
      const innerText = textParts
        .join('')
        .toLocaleLowerCase()
        .trim()
        .replace(NO_BREAK_SPACE_REGEX, ' ');
      const score = nodeScorer.score(node, innerText, record.attributeValues);
      if (score <= 0) continue;
      if (
        node instanceof HTMLElement &&
        this.searchableAttributeSettings.isLinkOrButtonOrInput(node)
      ) {
        const insertion = actions.findIndex(match => match.score < score);
        if (insertion !== -1) actions.splice(insertion, 0, { node, score });
        else if (actions.length < resultLimit) actions.push({ node, score });
        if (actions.length > resultLimit) actions.pop();
      }
      if (
        (!this.hasDirectSearchableText(node) && !node.matches(TEXT_BLOCK_SELECTOR)) ||
        !nodeScorer.textMatchesWithValue(innerText)
      )
        continue;
      const textContainer = this.textContainerForNode(node);
      const action = this.actionableAncestorForNode(node);
      const existingMatch = textMatchesByContainer.get(textContainer);
      if (existingMatch) {
        existingMatch.action ??= action;
        continue;
      }
      const insertion = matchingText.findIndex(match =>
        Boolean(
          match.node.compareDocumentPosition(textContainer) & Node.DOCUMENT_POSITION_PRECEDING,
        ),
      );
      const match = { node: textContainer, action };
      if (insertion !== -1) matchingText.splice(insertion, 0, match);
      else if (matchingText.length < resultLimit) matchingText.push(match);
      else continue;
      textMatchesByContainer.set(textContainer, match);
      if (matchingText.length > resultLimit) {
        textMatchesByContainer.delete(matchingText.pop()!.node);
      }
    }
    for (const match of matchingText) {
      if (match.action) continue;
      const walker = document.createTreeWalker(match.node, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        if (++processed % SEARCH_CHUNK_SIZE === 0) await yieldToMainThread(searchSignal);
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
    };
  }

  disconnect() {
    this.lifetime.abort();
    this.observer.disconnect();
    this.records.clear();
    this.pendingSubtrees.clear();
  }
}

export type { SearchOptions, SearchResult, TextMatch };
export { DEFAULT_RESULT_LIMIT, PageSearchIndex };
