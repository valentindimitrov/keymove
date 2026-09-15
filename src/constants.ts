export const MAC_OS_PLATFORMS = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];

export const KEYS_VALID_FOR_FOCUS_REGEX = /^[a-zA-Z0-9-_/]$/i;

export const KEYMOVE_ROOT_ID = 'keymove-root';
export const KEYMOVE_APP_ID = 'keymove-app';
export const KEYMOVE_PORTAL_ID = 'keymove-portal';
export const KEYMOVE_INPUT_ID = 'keymove-input';
export const KEYMOVE_SUGGESTIONS_ID = 'keymove-suggestions';
export const KEYMOVE_HIGHLIGHT_NAME = 'keymove-search-results';
export const KEYMOVE_CURRENT_HIGHLIGHT_NAME = 'keymove-search-current';

export const KEYMOVE_CONTAINER_HEIGHT = 50;
export const KEYMOVE_CONTAINER_WIDTH = 550;
export const POPUP_POSITION_STORAGE_KEY = 'popupPosition';
export const POPUP_WIDTH_STORAGE_KEY = 'popupWidth';
// Narrow enough to stay out of the way, wide enough for a result row to stay on one line.
export const MIN_CONTAINER_WIDTH = 260;
export const MAX_CONTAINER_WIDTH = 900;
export const HIGHLIGHT_COLORS_STORAGE_KEY = 'highlightColors';

export const INPUT_NODE_TYPES = ['INPUT', 'TEXTAREA', 'SELECT'];
export const LINK_OR_BUTTON_OR_INPUT_TYPES = ['BUTTON', 'A', 'LINK', 'INPUT', 'TEXTAREA', 'SELECT'];
export const LINK_OR_BUTTON_ROLE_VALUES = ['link', 'button', 'checkbox', 'tab'];
export const DO_NOT_SEARCH_NODE_TYPES = ['SCRIPT', 'STYLE'];

export const FIELD_BOOSTS = {
  innerText: 1,
  attribute: 0.9,
};

export const IS_VISIBLE_BOOST = 1.1;
export const STARTS_WITH_BOOST = 1.5;

export const MIN_FUZZY_QUERY_LENGTH = 3;
export const SHORT_FUZZY_QUERY_LENGTH = 6;
export const MAX_FUZZY_DISTANCE = 2;
export const FUZZY_DISTANCE_PENALTY = 0.6;

// A search is more often a way to reach a control than to read, so actions win near-ties.
export const ACTION_PRIORITY_BOOST = 1.25;
export const DEFAULT_SUGGESTION_COUNT = 3;
export const MAX_SUGGESTION_COUNT = 5;
export const MIN_SUGGESTION_QUERY_LENGTH = 3;
// A challenger must beat the result already holding a place by this margin before they swap,
// so results that score almost identically stop trading places on every keystroke.
export const SUGGESTION_SWAP_MARGIN = 1.15;
// Enough to decide which side of the bar the list fits on before it has been laid out.
export const SUGGESTION_ROW_HEIGHT = 46;
export const SUGGESTION_PANEL_PADDING = 12;

export const SETTINGS_KEYS = {
  SUGGESTION_COUNT: 'suggestionCount',
  LOCK_POSITION_AND_SIZE: 'lockPositionAndSize',
  AUTO_HIDE: 'autoHide',
  ALWAYS_ON: 'alwaysOn',
  START_IN_ACTION_MODE: 'startInActionMode',
  HIGHLIGHT_MATCHES: 'highlightMatches',
  SHOW_AUTOHIDE_BUTTON: 'showAutohideButton',
} as const;
