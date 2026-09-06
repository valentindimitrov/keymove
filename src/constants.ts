export const MAC_OS_PLATFORMS = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];

export const KEYS_VALID_FOR_FOCUS_REGEX = /^[a-zA-Z0-9-_/]$/i;

export const KEYMOVE_ROOT_ID = 'keymove-root';
export const KEYMOVE_APP_ID = 'keymove-app';
export const KEYMOVE_PORTAL_ID = 'keymove-portal';
export const KEYMOVE_INPUT_ID = 'keymove-input';
export const KEYMOVE_HIGHLIGHT_NAME = 'keymove-search-results';
export const COMAKE_LANDING_PAGE_LINK = 'https://comake.io';

export const KEYMOVE_CONTAINER_HEIGHT = 50;
export const KEYMOVE_CONTAINER_WIDTH = 300;
export const POPUP_POSITION_STORAGE_KEY = 'popupPosition';

export const INPUT_NODE_TYPES = ['INPUT', 'TEXTAREA', 'SELECT'];
export const LINK_OR_BUTTON_OR_INPUT_TYPES = ['BUTTON', 'A', 'LINK', 'INPUT', 'TEXTAREA', 'SELECT'];
export const LINK_OR_BUTTON_ROLE_VALUES = ['link', 'button', 'checkbox', 'tab'];
export const DO_NOT_SEARCH_NODE_TYPES = ['SCRIPT', 'STYLE'];

export const FIELD_BOOSTS = {
  innerText: 1,
  attribute: 0.9,
};

export const SEARCH_TERM_BOOSTS = {
  searchText: 1,
  synonym: 0.9,
};

export const IS_VISIBLE_BOOST = 1.1;
export const STARTS_WITH_BOOST = 1.5;
export const RELEVANT_WORD_BOOST = 1.5;
export const RELEVANT_SELECTOR_BOOST = 1.6;

export const SETTINGS_KEYS = {
  AUTO_HIDE: 'autoHide',
  USE_ON_EVERY_WEBSITE: 'useOnEveryWebsite',
  ALWAYS_ON: 'alwaysOn',
} as const;
