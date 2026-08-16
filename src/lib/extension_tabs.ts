const INJECTABLE_PROTOCOLS = ['http:', 'https:', 'file:'];
const CHROME_WEB_STORE_HOSTS = ['chromewebstore.google.com'];

function isInjectableUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    if (!INJECTABLE_PROTOCOLS.includes(parsedUrl.protocol)) {
      return false;
    }

    if (CHROME_WEB_STORE_HOSTS.includes(parsedUrl.hostname)) {
      return false;
    }

    return !(
      parsedUrl.hostname === 'chrome.google.com' && parsedUrl.pathname.startsWith('/webstore')
    );
  } catch {
    return false;
  }
}

export { isInjectableUrl };
