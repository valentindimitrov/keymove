// @vitest-environment node
import { DEFAULT_POPUP_POSITION, validatePopupPosition } from './popup_position_schema.js';

test('accepts normalized popup coordinates', () => {
  expect(validatePopupPosition({ x: 0.2, y: 0.8 })).toEqual({
    position: { x: 0.2, y: 0.8 },
    issues: [],
  });
});

test.each([null, { x: -0.1, y: 0.5 }, { x: 0.5, y: 2 }, { x: 'center', y: 0.75 }])(
  'rejects invalid popup coordinates: %j',
  value => {
    const result = validatePopupPosition(value);
    expect(result.position).toEqual(DEFAULT_POPUP_POSITION);
    expect(result.issues.length).toBeGreaterThan(0);
  },
);
