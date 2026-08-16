import React from 'react';

const SEARCH_MODES = {
  TEXT: 'text',
  ACTIONS: 'actions',
} as const;

type SearchMode = (typeof SEARCH_MODES)[keyof typeof SEARCH_MODES];

type SearchNavigationState = {
  mode: SearchMode;
  results: {
    text: Element[];
    actions: HTMLElement[];
  };
  selectedIndices: Record<SearchMode, number>;
};

type SearchNavigationAction =
  | {
      type: 'set-results';
      textResults: Element[];
      actionResults: HTMLElement[];
      selectedActionIndex: number;
    }
  | { type: 'clear-results' }
  | { type: 'set-mode'; mode: SearchMode }
  | { type: 'set-selected-index'; mode: SearchMode; index: number };

const INITIAL_SEARCH_NAVIGATION_STATE: SearchNavigationState = {
  mode: SEARCH_MODES.ACTIONS,
  results: { text: [], actions: [] },
  selectedIndices: { text: 0, actions: 0 },
};

function clampIndex(index: number, resultCount: number) {
  if (resultCount === 0) {
    return 0;
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
          text: 0,
          actions: clampIndex(action.selectedActionIndex, action.actionResults.length),
        },
      };
    case 'clear-results':
      return {
        ...state,
        results: { text: [], actions: [] },
        selectedIndices: { text: 0, actions: 0 },
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

  const setResults = React.useCallback(
    (textResults: Element[], actionResults: HTMLElement[], selectedActionIndex: number) => {
      dispatch({
        type: 'set-results',
        textResults,
        actionResults,
        selectedActionIndex,
      });
    },
    [],
  );

  const clearResults = React.useCallback(() => dispatch({ type: 'clear-results' }), []);

  const setMode = React.useCallback((mode: SearchMode) => dispatch({ type: 'set-mode', mode }), []);

  const setSelectedIndex = React.useCallback(
    (mode: SearchMode, index: number) => dispatch({ type: 'set-selected-index', mode, index }),
    [],
  );

  return { state, setResults, clearResults, setMode, setSelectedIndex };
}

export type { SearchMode, SearchNavigationAction, SearchNavigationState };
export { INITIAL_SEARCH_NAVIGATION_STATE, SEARCH_MODES, searchNavigationReducer };
export default useSearchNavigation;
