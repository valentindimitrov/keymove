const INJECTABLE_PROTOCOLS = ['http:', 'https:', 'file:'];
const OPENABLE_LINK_PROTOCOLS = ['http:', 'https:'];
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

function normalizedOpenableLinkUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    return OPENABLE_LINK_PROTOCOLS.includes(parsedUrl.protocol) ? parsedUrl.href : null;
  } catch {
    return null;
  }
}

export { isInjectableUrl, normalizedOpenableLinkUrl };
