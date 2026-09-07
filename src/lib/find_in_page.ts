import NodeScorer from './node_scorer.js';
import { PageSearchIndex } from './page_search_index.js';

let sharedIndex: PageSearchIndex | null = null;
let sharedIndexHost: string | null = null;
const pageChangeListeners = new Set<() => void>();

function releasePageSearchIndex() {
  sharedIndex?.disconnect();
  sharedIndex = null;
  sharedIndexHost = null;
}

function subscribeToPageChanges(listener: () => void) {
  pageChangeListeners.add(listener);
  return () => {
    pageChangeListeners.delete(listener);
    if (pageChangeListeners.size === 0) releasePageSearchIndex();
  };
}

class FindInPage {
  readonly searchText: string;
  readonly nodeScorer: NodeScorer;

  constructor(searchText: string) {
    this.searchText = searchText.toLocaleLowerCase().trimStart();
    this.nodeScorer = new NodeScorer(this.searchText);
  }

  findMatches(options: { signal?: AbortSignal; limit?: number } = {}) {
    if (this.searchText.length === 0) {
      return Promise.resolve({
        matchingText: [],
        matchingLinksAndButtons: [],
        isFuzzy: false,
      });
    }
    const host = window.location.host;
    if (!sharedIndex || sharedIndexHost !== host || sharedIndex.root !== document.body) {
      if (sharedIndex) {
        sharedIndex.disconnect();
      }

      sharedIndexHost = host;
      sharedIndex = new PageSearchIndex(() => {
        if (sharedIndex?.root !== document.body) releasePageSearchIndex();
        pageChangeListeners.forEach(listener => listener());
      });
    }
    return sharedIndex.search(this.nodeScorer, options);
  }
}

export default FindInPage;
export { releasePageSearchIndex, subscribeToPageChanges };
