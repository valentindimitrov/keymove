import createExtensionRoot from './create_extension_root.js';
import { YIPYIP_APP_ID, YIPYIP_PORTAL_ID, YIPYIP_ROOT_ID } from '../constants.js';

afterEach(() => {
  document.body.innerHTML = '';
});

test('mounts styles and UI targets inside an isolated shadow root', () => {
  const result = createExtensionRoot(':host { color: red; }', 'firefox');

  expect(result.host.id).toBe(YIPYIP_ROOT_ID);
  expect(result.host.classList.contains('yipyip-firefox')).toBe(true);
  expect(result.shadowRoot.querySelector('style').textContent).toContain('color: red');
  expect(result.shadowRoot.getElementById(YIPYIP_APP_ID)).toBe(result.app);
  expect(result.shadowRoot.getElementById(YIPYIP_PORTAL_ID)).toBe(result.portal);
  expect(document.getElementById(YIPYIP_APP_ID)).toBeNull();
});

test('does not mount the extension twice', () => {
  createExtensionRoot('', 'chrome');
  expect(createExtensionRoot('', 'chrome')).toBeNull();
  expect(document.querySelectorAll(`#${YIPYIP_ROOT_ID}`)).toHaveLength(1);
});
