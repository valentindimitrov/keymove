import NodeScorer from './node_scorer.js';
import { PageSearchIndex } from './page_search_index.js';
import type { SearchOptions } from './page_search_index.js';
import { normalizeSearchText } from './search_text.js';
import { FrameSearch, mergeFrameResults } from './frame_search.js';
import type { SearchResult } from './page_search_index.js';
import { resultIsConnected } from './frame_target.js';

let sharedIndex: PageSearchIndex | null = null;
let sharedIndexHost: string | null = null;
const pageChangeListeners = new Set<() => void>();
const frames = new FrameSearch(() => pageChangeListeners.forEach(listener => listener()));
let frameController: AbortController | null = null;
let frameQuery = '';
let frameResults: SearchResult[] = [];
function stopFrameSearch() {
  frameController?.abort();
  frameController = null;
  frames.stop();
  frameQuery = '';
  frameResults = [];
}
function restoreFrameOrigins() {
  frames.restore();
}

function releasePageSearchIndex() {
  stopFrameSearch();
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
    this.searchText = normalizeSearchText(searchText).trimStart();
    this.nodeScorer = new NodeScorer(this.searchText);
  }

  async findMatches(options: SearchOptions & { onUpdate?: (result: SearchResult) => void } = {}) {
    if (this.searchText.length === 0) {
      stopFrameSearch();
      return { matchingText: [], matchingLinksAndButtons: [], suggestions: [], isFuzzy: false };
    }
    frameController?.abort();
    frameController = new AbortController();
    const currentFrames = frameController;
    if (frameQuery !== this.searchText) frameResults = [];
    frameQuery = this.searchText;
    const cancel = () => currentFrames.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
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
    let local: SearchResult;
    try {
      local = await sharedIndex.search(this.nodeScorer, options);
    } catch (error) {
      currentFrames.abort();
      options.signal?.removeEventListener('abort', cancel);
      throw error;
    }
    if (options.onUpdate && !options.signal?.aborted) {
      void frames
        .search(this.searchText, currentFrames.signal, results => {
          if (!currentFrames.signal.aborted && !options.signal?.aborted) {
            frameResults = results;
            options.onUpdate?.(mergeFrameResults([local, ...results]));
          }
        })
        .catch(() => {})
        .finally(() => options.signal?.removeEventListener('abort', cancel));
    } else options.signal?.removeEventListener('abort', cancel);
    return mergeFrameResults([
      local,
      ...frameResults.map(result => ({
        ...result,
        matchingText: result.matchingText.filter(match => resultIsConnected(match.node)),
        matchingLinksAndButtons: result.matchingLinksAndButtons.filter(resultIsConnected),
        suggestions: result.suggestions.filter(match => resultIsConnected(match.node)),
      })),
    ]);
  }
}

export default FindInPage;
export { releasePageSearchIndex, subscribeToPageChanges, stopFrameSearch, restoreFrameOrigins };
