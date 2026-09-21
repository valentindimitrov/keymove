// @vitest-environment node
import { MAX_CONTAINER_WIDTH, MIN_CONTAINER_WIDTH } from '../constants.js';
import { DEFAULT_POPUP_WIDTH, validatePopupWidth } from './popup_width_schema.js';

test('keeps a width that is already usable', () => {
  expect(validatePopupWidth(500)).toEqual({ width: 500, issues: [] });
});

test('corrects a width outside the range rather than discarding the choice', () => {
  // A window that shrank between sessions should not cost someone their chosen width.
  expect(validatePopupWidth(50)).toEqual({ width: MIN_CONTAINER_WIDTH, issues: [] });
  expect(validatePopupWidth(5000)).toEqual({ width: MAX_CONTAINER_WIDTH, issues: [] });
  expect(validatePopupWidth(420.6)).toEqual({ width: 421, issues: [] });
});

test('falls back to the default for anything that is not a usable number', () => {
  for (const value of ['420', null, Number.NaN, Infinity, {}]) {
    const result = validatePopupWidth(value);
    expect(result.width).toBe(DEFAULT_POPUP_WIDTH);
    expect(result.issues).toHaveLength(1);
  }
});

test('uses the default when nothing has been stored', () => {
  expect(validatePopupWidth(undefined)).toEqual({ width: DEFAULT_POPUP_WIDTH, issues: [] });
});
