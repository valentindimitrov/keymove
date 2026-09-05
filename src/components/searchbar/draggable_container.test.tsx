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
  expect(normalizedPosition(350, 575, 1000, 800)).toEqual({ x: 0.5, y: 0.75 });
});

test('keeps popup position calculations finite before a viewport is measurable', () => {
  expect(normalizedPosition(0, 0, 0, 0)).toEqual({ x: 1, y: 1 });
});
