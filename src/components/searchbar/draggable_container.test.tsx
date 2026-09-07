import { KEYMOVE_CONTAINER_HEIGHT, KEYMOVE_CONTAINER_WIDTH } from '../../constants.js';
import { normalizedPosition, pixelPosition } from './draggable_container.js';

test('places the popup center at the stored normalized viewport position', () => {
  const viewportWidth = 1000;
  const viewportHeight = 800;

  expect(pixelPosition({ x: 0.5, y: 0.75 }, viewportWidth, viewportHeight)).toEqual({
    left: viewportWidth * 0.5 - KEYMOVE_CONTAINER_WIDTH / 2,
    top: viewportHeight * 0.75 - KEYMOVE_CONTAINER_HEIGHT / 2,
  });
});

test('converts dragged pixel coordinates back to normalized center coordinates', () => {
  const left = 1000 * 0.5 - KEYMOVE_CONTAINER_WIDTH / 2;
  const top = 800 * 0.75 - KEYMOVE_CONTAINER_HEIGHT / 2;

  expect(normalizedPosition(left, top, 1000, 800)).toEqual({ x: 0.5, y: 0.75 });
});

test('keeps popup position calculations finite before a viewport is measurable', () => {
  expect(normalizedPosition(0, 0, 0, 0)).toEqual({ x: 1, y: 1 });
});

test('positions and clamps against the width in use, not the default one', () => {
  const wide = 800;

  expect(pixelPosition({ x: 0.5, y: 0.75 }, 1000, 800, wide)).toEqual({
    left: 1000 * 0.5 - wide / 2,
    top: 800 * 0.75 - KEYMOVE_CONTAINER_HEIGHT / 2,
  });
  // A bar too wide to centre is pulled back on-screen rather than hanging off the right.
  expect(pixelPosition({ x: 0.95, y: 0.5 }, 1000, 800, wide).left).toBe(200);
  expect(normalizedPosition(1000 * 0.5 - wide / 2, 0, 1000, 800, wide).x).toBe(0.5);
});
