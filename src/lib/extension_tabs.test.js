import { isInjectableUrl } from './extension_tabs.js';

describe('isInjectableUrl', () => {
  test.each(['https://example.com', 'http://localhost:3000/path', 'file:///C:/example.html'])(
    'allows a web content URL: %s',
    url => {
      expect(isInjectableUrl(url)).toBe(true);
    },
  );

  test.each([
    undefined,
    '',
    'not a URL',
    'vivaldi://settings',
    'chrome://extensions',
    'chrome-extension://extension-id/page.html',
    'https://chromewebstore.google.com/detail/example/extension-id',
    'https://chrome.google.com/webstore/detail/example/extension-id',
    'about:blank',
  ])('rejects a protected or invalid URL: %s', url => {
    expect(isInjectableUrl(url)).toBe(false);
  });
});
