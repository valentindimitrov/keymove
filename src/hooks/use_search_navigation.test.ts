import {
  INITIAL_SEARCH_NAVIGATION_STATE,
  SEARCH_MODES,
  searchNavigationReducer,
} from './use_search_navigation.js';

test('keeps text and action results in separate navigation collections', () => {
  const textResult = document.createElement('p');
  const actionResult = document.createElement('button');

  const state = searchNavigationReducer(INITIAL_SEARCH_NAVIGATION_STATE, {
    type: 'set-results',
    textResults: [textResult],
    actionResults: [actionResult],
    selectedActionIndex: 0,
  });

  expect(state.results.text).toEqual([textResult]);
  expect(state.results.actions).toEqual([actionResult]);
  expect(state.selectedIndices).toEqual({ text: 0, actions: 0 });
});

test('tracks independent selected indices for each mode', () => {
  const textResults = [document.createElement('p'), document.createElement('p')];
  const actionResults = [document.createElement('button'), document.createElement('a')];
  let state = searchNavigationReducer(INITIAL_SEARCH_NAVIGATION_STATE, {
    type: 'set-results',
    textResults,
    actionResults,
    selectedActionIndex: 1,
  });

  state = searchNavigationReducer(state, {
    type: 'set-selected-index',
    mode: SEARCH_MODES.TEXT,
    index: 1,
  });
  state = searchNavigationReducer(state, {
    type: 'set-mode',
    mode: SEARCH_MODES.TEXT,
  });

  expect(state.mode).toBe(SEARCH_MODES.TEXT);
  expect(state.selectedIndices).toEqual({ text: 1, actions: 1 });
});

test('clamps selected indices and resets them when results are cleared', () => {
  const actionResult = document.createElement('button');
  let state = searchNavigationReducer(INITIAL_SEARCH_NAVIGATION_STATE, {
    type: 'set-results',
    textResults: [],
    actionResults: [actionResult],
    selectedActionIndex: 20,
  });

  expect(state.selectedIndices.actions).toBe(0);

  state = searchNavigationReducer(state, { type: 'clear-results' });
  expect(state.results).toEqual({ text: [], actions: [] });
  expect(state.selectedIndices).toEqual({ text: 0, actions: 0 });
});
