import { KEYMOVE_APP_ID, KEYMOVE_PORTAL_ID, KEYMOVE_ROOT_ID } from '../constants.js';
import { activeModal, MODAL_CHANGED_EVENT } from './modal_context.js';
import {
  pageShadowRoots,
  isKeyMoveNode,
  PAGE_ROOTS_CHANGED,
  retainPageRoot,
  releasePageRoot,
} from './dom_tree.js';

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
  if (
    document.getElementById(KEYMOVE_ROOT_ID) ||
    pageShadowRoots().some(root => root.getElementById(KEYMOVE_ROOT_ID))
  ) {
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
  const shadowObservers = new Map<ShadowRoot, MutationObserver>();
  const reconnect = () => {
    if (movingExtensionRoot) return;
    for (const [root, watched] of shadowObservers) {
      if (!root.host.isConnected || isKeyMoveNode(root)) {
        watched.disconnect();
        shadowObservers.delete(root);
        releasePageRoot(root);
      }
    }
    // A native dialog can open before the first search. Its focus event exposes the
    // host chain even though document queries cannot enter that component.
    let focusedElement = document.activeElement;
    while (focusedElement?.shadowRoot && !isKeyMoveNode(focusedElement)) {
      watchRoot(focusedElement.shadowRoot);
      focusedElement = focusedElement.shadowRoot.activeElement;
    }
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
    if (records.some(record => !isKeyMoveNode(record.target))) reconnect();
  });
  const options: MutationObserverInit = {
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
  };
  observer.observe(document.documentElement, options);
  const watchRoot = (root: ShadowRoot) => {
    if (shadowObservers.has(root)) return;
    const watched = new MutationObserver(records => {
      if (records.some(record => !isKeyMoveNode(record.target))) reconnect();
    });
    watched.observe(root, options);
    shadowObservers.set(root, watched);
    // Mounting outlives a search. Keep modal discovery alive after activation clears
    // the query and releases its index, or the UI would fall outside native inertness.
    retainPageRoot(root);
  };
  const refreshRoots = () => {
    const roots = new Set(pageShadowRoots());
    for (const [root, watched] of shadowObservers) {
      if (!roots.has(root)) {
        watched.disconnect();
        shadowObservers.delete(root);
        releasePageRoot(root);
      }
    }
    for (const root of roots) {
      watchRoot(root);
    }
    reconnect();
  };
  document.addEventListener(PAGE_ROOTS_CHANGED, refreshRoots);
  document.addEventListener('focusin', reconnect, true);
  document.addEventListener('toggle', reconnect, true);
  document.addEventListener('close', reconnect, true);
  reconnect();
  return {
    disconnect() {
      observer.disconnect();
      for (const [root, watched] of shadowObservers) {
        watched.disconnect();
        releasePageRoot(root);
      }
      shadowObservers.clear();
      document.removeEventListener(PAGE_ROOTS_CHANGED, refreshRoots);
      document.removeEventListener('focusin', reconnect, true);
      document.removeEventListener('toggle', reconnect, true);
      document.removeEventListener('close', reconnect, true);
    },
  };
}

export default createExtensionRoot;
export { keepExtensionRootConnected };
