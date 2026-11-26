// @vitest-environment node
import { actionsForImage } from './result_actions.js';

test('the larger viewer is unavailable for images from frames', () => {
  const image = {
    url: 'https://example.com/photo.png',
    link: null,
    token: 't',
  } as unknown as Parameters<typeof actionsForImage>[0];
  const view = (fromFrame: boolean) =>
    actionsForImage(image, fromFrame).find(action => action.id === 'image-view');
  expect(view(false)?.disabled).toBe(false);
  expect(view(true)?.disabled).toBe(true);
});
