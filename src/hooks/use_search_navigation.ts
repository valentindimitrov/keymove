import React from 'react';
import type { TextMatch } from '../lib/page_search_index.js';

const SEARCH_MODES = {
  TEXT: 'text',
  ACTIONS: 'actions',
} as const;

type SearchMode = (typeof SEARCH_MODES)[keyof typeof SEARCH_MODES];

type SearchNavigationState = {
  mode: SearchMode;
  results: {
    text: TextMatch[];
    actions: HTMLElement[];
  };
  selectedIndices: Record<SearchMode, number | null>;
};

type SearchNavigationAction =
  | {
      type: 'set-results';
      textResults: TextMatch[];
      actionResults: HTMLElement[];
    }
  | { type: 'clear-results' }
  | { type: 'set-mode'; mode: SearchMode }
  | { type: 'set-selected-index'; mode: SearchMode; index: number | null };

const INITIAL_SEARCH_NAVIGATION_STATE: SearchNavigationState = {
  mode: SEARCH_MODES.TEXT,
  results: { text: [], actions: [] },
  selectedIndices: { text: null, actions: null },
};

function clampIndex(index: number | null, resultCount: number) {
  if (index === null || resultCount === 0) {
    return null;
  }
  return Math.min(Math.max(index, 0), resultCount - 1);
}

function searchNavigationReducer(
  state: SearchNavigationState,
  action: SearchNavigationAction,
): SearchNavigationState {
  switch (action.type) {
    case 'set-results':
      return {
        ...state,
        results: {
          text: action.textResults,
          actions: action.actionResults,
        },
        selectedIndices: {
          text: null,
          actions: null,
        },
        mode: SEARCH_MODES.TEXT,
      };
    case 'clear-results':
      return {
        ...state,
        results: { text: [], actions: [] },
        selectedIndices: { text: null, actions: null },
        mode: SEARCH_MODES.TEXT,
      };
    case 'set-mode':
      return { ...state, mode: action.mode };
    case 'set-selected-index': {
      const resultCount = state.results[action.mode].length;
      return {
        ...state,
        selectedIndices: {
          ...state.selectedIndices,
          [action.mode]: clampIndex(action.index, resultCount),
        },
      };
    }
  }
}

function useSearchNavigation() {
  const [state, dispatch] = React.useReducer(
    searchNavigationReducer,
    INITIAL_SEARCH_NAVIGATION_STATE,
  );

  const setResults = React.useCallback((textResults: TextMatch[], actionResults: HTMLElement[]) => {
    dispatch({ type: 'set-results', textResults, actionResults });
  }, []);

  const clearResults = React.useCallback(() => dispatch({ type: 'clear-results' }), []);

  const setMode = React.useCallback((mode: SearchMode) => dispatch({ type: 'set-mode', mode }), []);

  const setSelectedIndex = React.useCallback(
    (mode: SearchMode, index: number | null) =>
      dispatch({ type: 'set-selected-index', mode, index }),
    [],
  );

  return { state, setResults, clearResults, setMode, setSelectedIndex };
}

export type { SearchMode, SearchNavigationAction, SearchNavigationState };
export { INITIAL_SEARCH_NAVIGATION_STATE, SEARCH_MODES, searchNavigationReducer };
export default useSearchNavigation;
