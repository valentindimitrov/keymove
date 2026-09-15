import { KEYMOVE_CONTAINER_WIDTH, MAX_CONTAINER_WIDTH, MIN_CONTAINER_WIDTH } from '../constants.js';

const DEFAULT_POPUP_WIDTH = KEYMOVE_CONTAINER_WIDTH;

type PopupWidthValidation = { width: number; issues: string[] };

function clampWidth(width: number) {
  return Math.min(Math.max(Math.round(width), MIN_CONTAINER_WIDTH), MAX_CONTAINER_WIDTH);
}

function validatePopupWidth(value: unknown): PopupWidthValidation {
  if (value === undefined) {
    return { width: DEFAULT_POPUP_WIDTH, issues: [] };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { width: DEFAULT_POPUP_WIDTH, issues: ['Popup width must be a finite number.'] };
  }
  // A width outside the range is corrected rather than rejected, so a window that shrank
  // between sessions does not throw away a deliberate choice.
  return { width: clampWidth(value), issues: [] };
}

export { DEFAULT_POPUP_WIDTH, clampWidth, validatePopupWidth };
