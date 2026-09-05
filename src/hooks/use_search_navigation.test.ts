import {
  INITIAL_SEARCH_NAVIGATION_STATE,
  SEARCH_MODES,
  searchNavigationReducer,
} from './use_search_navigation.js';

test('keeps text and action results in separate navigation collections', () => {
  const textResult = document.createElement('p');
  const actionResult = document.createElement('button');
  const textMatch = { node: textResult, action: null };

  const state = searchNavigationReducer(INITIAL_SEARCH_NAVIGATION_STATE, {
    type: 'set-results',
    textResults: [textMatch],
    actionResults: [actionResult],
  });

  expect(state.results.text).toEqual([textMatch]);
  expect(state.results.actions).toEqual([actionResult]);
  expect(state.selectedIndices).toEqual({ text: null, actions: null });
  expect(state.mode).toBe(SEARCH_MODES.TEXT);
});

test('tracks independent selected indices for each mode', () => {
  const textResults = [
    { node: document.createElement('p'), action: null },
    { node: document.createElement('p'), action: null },
  ];
  const actionResults = [document.createElement('button'), document.createElement('a')];
  let state = searchNavigationReducer(INITIAL_SEARCH_NAVIGATION_STATE, {
    type: 'set-results',
    textResults,
    actionResults,
  });

  state = searchNavigationReducer(state, {
    type: 'set-selected-index',
    mode: SEARCH_MODES.TEXT,
    index: 1,
  });
  state = searchNavigationReducer(state, {
    type: 'set-selected-index',
    mode: SEARCH_MODES.ACTIONS,
    index: 1,
  });
  state = searchNavigationReducer(state, {
    type: 'set-mode',
    mode: SEARCH_MODES.ACTIONS,
  });

  expect(state.mode).toBe(SEARCH_MODES.ACTIONS);
  expect(state.selectedIndices).toEqual({ text: 1, actions: 1 });
});

test('clamps selected indices and resets them when results are cleared', () => {
  const actionResult = document.createElement('button');
  let state = searchNavigationReducer(INITIAL_SEARCH_NAVIGATION_STATE, {
    type: 'set-results',
    textResults: [],
    actionResults: [actionResult],
  });

  state = searchNavigationReducer(state, {
    type: 'set-selected-index',
    mode: SEARCH_MODES.ACTIONS,
    index: 20,
  });
  expect(state.selectedIndices.actions).toBe(0);

  state = searchNavigationReducer(state, { type: 'clear-results' });
  expect(state.results).toEqual({ text: [], actions: [] });
  expect(state.selectedIndices).toEqual({ text: null, actions: null });
  expect(state.mode).toBe(SEARCH_MODES.TEXT);
});
