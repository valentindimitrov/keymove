import {
  KEYMOVE_CONTAINER_WIDTH,
  MAX_CONTAINER_WIDTH,
  MIN_CONTAINER_WIDTH,
  POPUP_WIDTH_STORAGE_KEY,
} from '../constants.js';
import { isRecord } from './runtime_schema.js';

const DEFAULT_POPUP_WIDTH = KEYMOVE_CONTAINER_WIDTH;

type PopupWidthValidation = { width: number; issues: string[] };

function clampWidth(width: number) {
  return Math.min(Math.max(Math.round(width), MIN_CONTAINER_WIDTH), MAX_CONTAINER_WIDTH);
}

// Resizing is symmetric about the bar's centre, so the nearer viewport edge is what runs
// out of room first. Shared by the drag handles and the keyboard shortcuts.
function widthAboutCenter(width: number, center: number, viewportWidth: number) {
  const room = 2 * Math.min(center, viewportWidth - center);
  return clampWidth(Math.min(width, Math.max(MIN_CONTAINER_WIDTH, room)));
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

function validateStoredPopupWidth(data: unknown): PopupWidthValidation {
  if (!isRecord(data)) return validatePopupWidth(null);
  return validatePopupWidth(
    Object.hasOwn(data, POPUP_WIDTH_STORAGE_KEY) ? data[POPUP_WIDTH_STORAGE_KEY] : undefined,
  );
}

function validatePopupWidthChange(change: unknown): PopupWidthValidation {
  if (!isRecord(change)) return validatePopupWidth(null);
  return validatePopupWidth(Object.hasOwn(change, 'newValue') ? change['newValue'] : undefined);
}

export type { PopupWidthValidation };
export {
  DEFAULT_POPUP_WIDTH,
  clampWidth,
  widthAboutCenter,
  validatePopupWidth,
  validateStoredPopupWidth,
  validatePopupWidthChange,
};
