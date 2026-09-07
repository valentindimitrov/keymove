import type { RankedMatch, SearchResult, TextMatch } from '../lib/page_search_index.js';

// Search results have gained a field four times over (`term`, `score`, `distance`,
// `suggestions`), and each time every literal in every test had to be found and corrected.
// Building them here means the next field is one default rather than thirty edits.

function makeTextMatch(overrides: Partial<TextMatch> = {}): TextMatch {
  return {
    node: document.createElement('p'),
    action: null,
    term: 'save',
    score: 1,
    distance: null,
    ...overrides,
  };
}

function makeRankedMatch(overrides: Partial<RankedMatch> = {}): RankedMatch {
  return {
    kind: 'action',
    node: document.createElement('button'),
    score: 1,
    term: 'save',
    distance: null,
    ...overrides,
  };
}

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    matchingText: [],
    matchingLinksAndButtons: [],
    suggestions: [],
    isFuzzy: false,
    ...overrides,
  };
}

export { makeRankedMatch, makeSearchResult, makeTextMatch };
