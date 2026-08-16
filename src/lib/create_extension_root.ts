import { YIPYIP_APP_ID, YIPYIP_PORTAL_ID, YIPYIP_ROOT_ID } from '../constants.js';

type ExtensionRoot = {
  app: HTMLDivElement;
  host: HTMLDivElement;
  portal: HTMLDivElement;
  shadowRoot: ShadowRoot;
};

function createExtensionRoot(stylesText: string, browserName?: string): ExtensionRoot | null {
  if (document.getElementById(YIPYIP_ROOT_ID)) {
    return null;
  }

  const host = document.createElement('div');
  host.id = YIPYIP_ROOT_ID;
  if (browserName === 'firefox') {
    host.classList.add('yipyip-firefox');
  }

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const styles = document.createElement('style');
  styles.textContent = stylesText;

  const app = document.createElement('div');
  app.id = YIPYIP_APP_ID;

  const portal = document.createElement('div');
  portal.id = YIPYIP_PORTAL_ID;

  shadowRoot.append(styles, app, portal);
  document.body.appendChild(host);

  return { app, host, portal, shadowRoot };
}

export default createExtensionRoot;
