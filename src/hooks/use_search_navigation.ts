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
      preserveSelection?: boolean;
    }
  | { type: 'clear-results' }
  | { type: 'reset'; mode: SearchMode }
  | { type: 'set-mode'; mode: SearchMode }
  | { type: 'set-selected-index'; mode: SearchMode; index: number | null };

const INITIAL_SEARCH_NAVIGATION_STATE: SearchNavigationState = {
  mode: SEARCH_MODES.TEXT,
  results: { text: [], actions: [] },
  selectedIndices: { text: null, actions: null },
};

// An empty mode falls back to the other collection. Derive this without changing the
// chosen mode, so it returns as soon as a later query has matching results again.
function effectiveSearchMode(state: SearchNavigationState): SearchMode {
  if (
    state.mode === SEARCH_MODES.TEXT &&
    state.results.text.length === 0 &&
    state.results.actions.length > 0
  ) {
    return SEARCH_MODES.ACTIONS;
  }
  if (
    state.mode === SEARCH_MODES.ACTIONS &&
    state.results.actions.length === 0 &&
    state.results.text.length > 0
  ) {
    return SEARCH_MODES.TEXT;
  }
  return state.mode;
}

function clampIndex(index: number | null, resultCount: number) {
  if (index === null || resultCount === 0) {
    return null;
  }
  return Math.min(Math.max(index, 0), resultCount - 1);
}

// Selecting the first result keeps Enter usable the moment matches arrive, without
// waiting for a Tab press.
function selectionForResults(index: number | null, resultCount: number) {
  if (resultCount === 0) {
    return null;
  }
  return index === null ? 0 : clampIndex(index, resultCount);
}

function searchNavigationReducer(
  state: SearchNavigationState,
  action: SearchNavigationAction,
): SearchNavigationState {
  switch (action.type) {
    case 'set-results': {
      const retainedTextIndex = action.preserveSelection
        ? retainedIndex(
            state.results.text.map(match => match.node),
            action.textResults.map(match => match.node),
            state.selectedIndices.text,
          )
        : null;
      const retainedActionIndex = action.preserveSelection
        ? retainedIndex(state.results.actions, action.actionResults, state.selectedIndices.actions)
        : null;
      // The mode is a deliberate choice, so results arriving for a new query must not
      // silently drop the user back into text mode mid-search.
      return {
        ...state,
        results: {
          text: action.textResults,
          actions: action.actionResults,
        },
        // A live refresh keeps whatever the user was parked on, and clears the cursor when
        // that node disappears rather than silently moving Enter onto an unrelated match.
        selectedIndices: {
          text: action.preserveSelection
            ? retainedTextIndex
            : selectionForResults(retainedTextIndex, action.textResults.length),
          actions: action.preserveSelection
            ? retainedActionIndex
            : selectionForResults(retainedActionIndex, action.actionResults.length),
        },
      };
    }
    case 'clear-results':
      // Fires on every keystroke, so it must leave the chosen mode alone.
      return {
        ...state,
        results: { text: [], actions: [] },
        selectedIndices: { text: null, actions: null },
      };
    case 'reset':
      // Fires when the search is genuinely over, which is where the default mode applies.
      return {
        mode: action.mode,
        results: { text: [], actions: [] },
        selectedIndices: { text: null, actions: null },
      };
    case 'set-mode':
      return {
        ...state,
        mode: action.mode,
        selectedIndices: {
          ...state.selectedIndices,
          [action.mode]: selectionForResults(
            state.selectedIndices[action.mode],
            state.results[action.mode].length,
          ),
        },
      };
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

function retainedIndex(previous: Element[], next: Element[], selectedIndex: number | null) {
  const node = selectedIndex === null ? undefined : previous[selectedIndex];
  const index = node ? next.indexOf(node) : -1;
  return index === -1 ? null : index;
}

function useSearchNavigation() {
  const [state, dispatch] = React.useReducer(
    searchNavigationReducer,
    INITIAL_SEARCH_NAVIGATION_STATE,
  );

  const setResults = React.useCallback(
    (textResults: TextMatch[], actionResults: HTMLElement[], preserveSelection = false) => {
      dispatch({ type: 'set-results', textResults, actionResults, preserveSelection });
    },
    [],
  );

  const clearResults = React.useCallback(() => dispatch({ type: 'clear-results' }), []);

  const reset = React.useCallback((mode: SearchMode) => dispatch({ type: 'reset', mode }), []);

  const setMode = React.useCallback((mode: SearchMode) => dispatch({ type: 'set-mode', mode }), []);

  const setSelectedIndex = React.useCallback(
    (mode: SearchMode, index: number | null) =>
      dispatch({ type: 'set-selected-index', mode, index }),
    [],
  );

  return { state, setResults, clearResults, reset, setMode, setSelectedIndex };
}

export type { SearchMode };
export {
  INITIAL_SEARCH_NAVIGATION_STATE,
  SEARCH_MODES,
  effectiveSearchMode,
  searchNavigationReducer,
};
export default useSearchNavigation;
