import { KEYMOVE_APP_ID, KEYMOVE_PORTAL_ID, KEYMOVE_ROOT_ID } from '../constants.js';

type ExtensionRoot = {
  app: HTMLDivElement;
  host: HTMLDivElement;
  portal: HTMLDivElement;
  shadowRoot: ShadowRoot;
};

function createExtensionRoot(stylesText: string, browserName?: string): ExtensionRoot | null {
  if (document.getElementById(KEYMOVE_ROOT_ID)) {
    return null;
  }

  const host = document.createElement('div');
  host.id = KEYMOVE_ROOT_ID;
  if (browserName === 'firefox') {
    host.classList.add('keymove-firefox');
  }

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const styles = document.createElement('style');
  styles.textContent = stylesText;

  const app = document.createElement('div');
  app.id = KEYMOVE_APP_ID;

  const portal = document.createElement('div');
  portal.id = KEYMOVE_PORTAL_ID;

  shadowRoot.append(styles, app, portal);
  document.body.appendChild(host);

  return { app, host, portal, shadowRoot };
}

function keepExtensionRootConnected(host: HTMLElement) {
  let observedBody = document.body;
  const reconnect = () => {
    if (observedBody !== document.body) {
      observedBody = document.body;
      observer.disconnect();
      observeParents();
    }
    if (!host.isConnected && document.body) {
      document.body.appendChild(host);
    }
  };
  const observer = new MutationObserver(reconnect);
  const observeParents = () => {
    observer.observe(document.documentElement, { childList: true });
    if (observedBody) observer.observe(observedBody, { childList: true });
  };
  observeParents();
  return observer;
}

export default createExtensionRoot;
export { keepExtensionRootConnected };
