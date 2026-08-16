import Utils from './utils.js';
import { DO_NOT_SEARCH_NODE_TYPES, YIPYIP_ROOT_ID } from '../constants.js';

const DEFAULT_RESULT_LIMIT = 50;
const SEARCH_CHUNK_SIZE = 100;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;

function abortError() {
  const error = new Error('Search cancelled');
  error.name = 'AbortError';
  return error;
}

function yieldToMainThread(signal) {
  if (signal && signal.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise((resolve, reject) => {
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
  constructor(searchableAttributeSettings, additionalSelectors=[]) {
    this.searchableAttributeSettings = searchableAttributeSettings;
    this.selector = [
      searchableAttributeSettings.searchableAttributeSettingsByNodeNameToQuerySelector(),
      ...additionalSelectors
    ].filter(Boolean).join(', ');
    this.records = new Map();
    this.handleMutations = this.handleMutations.bind(this);

    this.addSubtree(document.body);
    this.observer = new MutationObserver(this.handleMutations);
    this.observer.observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  isCandidate(node) {
    return node && node.nodeType === Node.ELEMENT_NODE &&
      node.id !== YIPYIP_ROOT_ID &&
      !DO_NOT_SEARCH_NODE_TYPES.includes(node.nodeName) &&
      node.matches(this.selector);
  }

  addCandidate(node) {
    if (this.isCandidate(node) && !this.records.has(node)) {
      this.records.set(node, null);
    }
  }

  addSubtree(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    this.addCandidate(root);
    root.querySelectorAll(this.selector).forEach(node => this.addCandidate(node));
  }

  removeSubtree(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    this.records.delete(root);
    root.querySelectorAll(this.selector).forEach(node => this.records.delete(node));
  }

  invalidateAncestors(node) {
    if (!node) {
      return;
    }

    let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (element && element !== document.body) {
      if (this.records.has(element)) {
        this.records.set(element, null);
      }
      element = element.parentElement;
    }
  }

  invalidateSubtree(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (this.records.has(root)) {
      this.records.set(root, null);
    }
    root.querySelectorAll(this.selector).forEach(node => {
      if (this.records.has(node)) {
        this.records.set(node, null);
      }
    });
  }

  handleMutations(mutations) {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.removedNodes.forEach(node => this.removeSubtree(node));
        mutation.addedNodes.forEach(node => this.addSubtree(node));
      } else if (mutation.type === 'attributes') {
        if (this.records.has(mutation.target) && !this.isCandidate(mutation.target)) {
          this.records.delete(mutation.target);
        }
        this.addSubtree(mutation.target);
        this.invalidateSubtree(mutation.target);
      }

      this.invalidateAncestors(mutation.target);
    });
  }

  recordForNode(node) {
    const cachedRecord = this.records.get(node);
    if (cachedRecord) {
      return cachedRecord;
    }

    const record = {
      node,
      innerText: Utils.getTextContentOfNode(node).toLocaleLowerCase().trim().replace(NO_BREAK_SPACE_REGEX, ' '),
      attributeValues: this.searchableAttributeSettings.searchableAttributeValuesForNode(node),
      visible: this.isVisible(node)
    };
    this.records.set(node, record);
    return record;
  }

  isVisible(node) {
    if (!node.isConnected || !(node.offsetWidth || node.offsetHeight || node.getClientRects().length)) {
      return false;
    }

    const computedStyle = window.getComputedStyle(node);
    return computedStyle.visibility !== 'hidden' && computedStyle.opacity !== '0';
  }

  async search(nodeScorer, { signal, limit=DEFAULT_RESULT_LIMIT }={}) {
    const nodes = [...this.records.keys()];
    const matches = [];

    for (let offset = 0; offset < nodes.length; offset += SEARCH_CHUNK_SIZE) {
      if (signal && signal.aborted) {
        throw abortError();
      }

      nodes.slice(offset, offset + SEARCH_CHUNK_SIZE).forEach(node => {
        if (!node.isConnected) {
          this.records.delete(node);
          return;
        }

        const record = this.recordForNode(node);
        if (!record.visible) {
          return;
        }

        const score = nodeScorer.scoreNodeWithValues(node, record.innerText, record.attributeValues);
        if (score > 0) {
          matches.push({ node, score });
        }
      });

      if (offset + SEARCH_CHUNK_SIZE < nodes.length) {
        await yieldToMainThread(signal);
      }
    }

    const matchingLinksAndButtons = matches
      .sort((first, second) => second.score - first.score)
      .slice(0, limit)
      .map(match => match.node);

    return {
      matchingNodes: matchingLinksAndButtons,
      matchingLinksAndButtons,
      bestMatchingLinkOrButtonIndex: matchingLinksAndButtons.length > 0 ? 0 : null
    };
  }

  disconnect() {
    this.observer.disconnect();
    this.records.clear();
  }
}

export { DEFAULT_RESULT_LIMIT, PageSearchIndex };
