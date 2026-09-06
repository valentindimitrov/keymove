import { DO_NOT_SEARCH_NODE_TYPES, KEYMOVE_ROOT_ID } from '../constants.js';
import NodeScorer from './node_scorer.js';
import SearchableAttributeSettings from './searchable_attribute_settings.js';
import { isTextVisible, visibleText } from './visible_text.js';
import type { StyleCache } from './visible_text.js';

const DEFAULT_RESULT_LIMIT = 50;
const SEARCH_CHUNK_SIZE = 100;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;
const TEXT_BLOCK_SELECTOR =
  'p, li, blockquote, pre, td, th, dt, dd, figcaption, h1, h2, h3, h4, h5, h6';

type SearchRecord = {
  attributeValues: string[];
};

type Match = { node: Element; score: number; innerText: string };
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

function yieldToMainThread(signal?: AbortSignal): Promise<void> {
  if (signal && signal.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise<void>((resolve, reject) => {
    const resume = () => {
      if (signal && signal.aborted) {
        reject(abortError());
      } else {
        resolve();
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(resume, { timeout: 16 });
    } else {
      window.setTimeout(resume, 0);
    }
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
    return [...node.childNodes].some(
      child => child.nodeType === Node.TEXT_NODE && (child.textContent?.trim().length ?? 0) > 0,
    );
  }

  addCandidate(node: Node | null) {
    if (this.isCandidate(node) && !this.records.has(node)) {
      this.records.set(node, null);
    }
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

    this.addCandidate(root);
    root.querySelectorAll('*').forEach(node => this.addCandidate(node));
  }

  removeSubtree(root: Node | null) {
    if (!(root instanceof Element)) {
      return;
    }

    this.records.delete(root);
    root.querySelectorAll('*').forEach(node => this.records.delete(node));
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

    this.refreshCandidate(root);
    root.querySelectorAll('*').forEach(node => this.refreshCandidate(node));
  }

  handleMutations(mutations: MutationRecord[]) {
    // A queued observer callback can outlive its DOM realm during teardown.
    if (typeof Element === 'undefined') {
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
    const nodes = [...this.records.keys()];
    const matches: Match[] = [];
    const styles: StyleCache = new WeakMap();

    for (let offset = 0; offset < nodes.length; offset += SEARCH_CHUNK_SIZE) {
      if (signal && signal.aborted) {
        throw abortError();
      }

      nodes.slice(offset, offset + SEARCH_CHUNK_SIZE).forEach(node => {
        if (!node.isConnected) {
          this.records.delete(node);
          return;
        }

        if (!this.isVisible(node, styles)) {
          return;
        }

        const record = this.recordForNode(node);
        // Visibility can change through ancestor styles without changing this node's text.
        const innerText = visibleText(node, styles)
          .toLocaleLowerCase()
          .trim()
          .replace(NO_BREAK_SPACE_REGEX, ' ');
        const score = nodeScorer.score(node, innerText, record.attributeValues);
        if (score > 0) {
          matches.push({ node, score, innerText });
        }
      });

      if (offset + SEARCH_CHUNK_SIZE < nodes.length) {
        await yieldToMainThread(signal);
      }
    }

    const textMatchesByContainer = new Map<Element, TextMatch>();
    matches.forEach(match => {
      if (
        (!this.hasDirectSearchableText(match.node) && !match.node.matches(TEXT_BLOCK_SELECTOR)) ||
        !nodeScorer.textMatchesWithValue(match.innerText)
      ) {
        return;
      }

      const textContainer = this.textContainerForNode(match.node);
      const action = this.actionableAncestorForNode(match.node);
      const existingMatch = textMatchesByContainer.get(textContainer);
      if (!existingMatch) {
        textMatchesByContainer.set(textContainer, { node: textContainer, action });
      } else if (!existingMatch.action && action) {
        existingMatch.action = action;
      }
    });
    textMatchesByContainer.forEach(match => {
      match.action ??= [...match.node.querySelectorAll(this.actionableSelector)].find(
        (node): node is HTMLElement => node instanceof HTMLElement && this.isVisible(node, styles),
      ) ?? null;
    });
    const matchingText = [...textMatchesByContainer.values()]
      .sort((first, second) =>
        first.node.compareDocumentPosition(second.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .slice(0, limit);
    const matchingLinksAndButtons = matches
      .filter(
        (match): match is Match & { node: HTMLElement } =>
          match.node instanceof HTMLElement &&
          this.searchableAttributeSettings.isLinkOrButtonOrInput(match.node),
      )
      .sort((first, second) => second.score - first.score)
      .slice(0, limit)
      .map(match => match.node);

    return {
      matchingText,
      matchingLinksAndButtons,
    };
  }

  disconnect() {
    this.observer.disconnect();
    this.records.clear();
  }
}

export type { SearchOptions, SearchResult, TextMatch };
export { DEFAULT_RESULT_LIMIT, PageSearchIndex };
