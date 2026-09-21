import { KEYMOVE_APP_ID, KEYMOVE_PORTAL_ID, KEYMOVE_ROOT_ID } from '../constants.js';
import { activeModal, MODAL_CHANGED_EVENT } from './modal_context.js';

let movingExtensionRoot = false;
export function isMovingExtensionRoot() {
  return movingExtensionRoot;
}

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
  // React handles clicks inside the shadow root first. Page listeners would see only
  // this shallow host, not the clicked control, and can mistake it for page content.
  // Do not prevent defaults or intercept clicks dispatched on actual page actions.
  host.addEventListener('click', event => event.stopPropagation());
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
  let previousModal: Element | null = null;
  const reconnect = () => {
    if (movingExtensionRoot) return;
    const modal = activeModal();
    const parent = modal ?? document.body;
    if (parent && (host.parentElement !== parent || modal !== previousModal)) {
      // Native modal dialogs make everything outside their subtree inert, including
      // extension UI. Keep the DOM inside, but render in the top layer: a transformed
      // drawer must not become the containing block for our viewport-positioned UI,
      // nor gain scrollable overflow from the searchbar and selection outlines.
      const focused = host.shadowRoot?.activeElement;
      movingExtensionRoot = true;
      try {
        const supportsPopover = typeof host.showPopover === 'function';
        if (supportsPopover && host.matches(':popover-open')) host.hidePopover();
        if (host.parentElement !== parent) {
          if (host.isConnected && typeof parent.moveBefore === 'function')
            parent.moveBefore(host, null);
          else parent.appendChild(host);
        }
        if (modal && supportsPopover) {
          // Manual avoids light-dismiss/Escape handling and leaves site popovers alone.
          host.setAttribute('popover', 'manual');
          host.showPopover();
        } else host.removeAttribute('popover');
        if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
      } finally {
        movingExtensionRoot = false;
      }
    }
    if (modal !== previousModal) {
      previousModal = modal;
      document.dispatchEvent(new Event(MODAL_CHANGED_EVENT));
    }
  };
  const observer = new MutationObserver(records => {
    if (
      records.some(
        record =>
          !(record.target instanceof Element && record.target.closest(`#${KEYMOVE_ROOT_ID}`)),
      )
    )
      reconnect();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'open',
      'aria-modal',
      'role',
      'hidden',
      'inert',
      'aria-hidden',
      'style',
      'class',
    ],
  });
  document.addEventListener('focusin', reconnect, true);
  document.addEventListener('toggle', reconnect, true);
  document.addEventListener('close', reconnect, true);
  reconnect();
  return {
    disconnect() {
      observer.disconnect();
      document.removeEventListener('focusin', reconnect, true);
      document.removeEventListener('toggle', reconnect, true);
      document.removeEventListener('close', reconnect, true);
    },
  };
}

export default createExtensionRoot;
export { keepExtensionRootConnected };
