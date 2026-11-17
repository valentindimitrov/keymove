import { browser } from 'wxt/browser';
import { KEYMOVE_ROOT_ID } from '../constants.js';
import { isKeyMoveRoot } from './dom_tree.js';
import { ensureHostMarkerSecret } from './host_marker_secret.js';

/**
 * Lets a newer copy of KeyMove remove host elements an earlier copy left behind.
 *
 * Firefox destroys an extension's content-script sandboxes when it is reloaded or
 * updated, but not the DOM they created, so the old host stays in the page with nothing
 * running behind it. A newer copy shares the DOM but not the old copy's isolated world,
 * and page script can forge ids, attributes, classes and open shadow roots. So every host
 * carries a marker element in its shadow root whose own shadow root is closed: page
 * script cannot read it, and only extension APIs can (`dom.openOrClosedShadowRoot` in
 * Chromium, `Element.openOrClosedShadowRoot` in Firefox content scripts). It holds a
 * per-installation secret kept in `storage.local`, which page script cannot read either.
 * A newer copy removes hosts that carry this secret and are not its own.
 *
 * Limits: a page can move KeyMove's genuine marker into an element it built to imitate
 * the host and so have that element removed when a newer copy starts. It cannot direct
 * removal at anything else: hosts with light-DOM children are kept, and the current
 * copy's host is recognised by reference. Hosts inside a page's shadow root (moved there
 * for a modal dialog in a web component) are not found.
 */

const SECRET_ATTRIBUTE = 'data-keymove-secret';

let secret: Promise<string | null> | undefined;
function hostMarkerSecret() {
  secret ??= ensureHostMarkerSecret();
  return secret;
}

/** Adds the closed-root marker to a host's shadow root; it is signed once the secret loads. */
export function signKeyMoveHost(shadowRoot: ShadowRoot) {
  const marker = document.createElement('span');
  marker.hidden = true;
  marker.style.display = 'none';
  const closed = marker.attachShadow({ mode: 'closed' });
  shadowRoot.append(marker);
  void hostMarkerSecret().then(value => {
    if (!value) return;
    const signature = document.createElement('span');
    signature.setAttribute(SECRET_ATTRIBUTE, value);
    closed.replaceChildren(signature);
  });
}

type ReadShadowRoot = (element: Element) => ShadowRoot | null;

/** Extension-only access to a closed shadow root; null where the browser offers none. */
export function openOrClosedShadowRoot(element: Element): ShadowRoot | null {
  try {
    const dom = (browser as unknown as { dom?: { openOrClosedShadowRoot?: ReadShadowRoot } }).dom;
    if (typeof dom?.openOrClosedShadowRoot === 'function')
      return dom.openOrClosedShadowRoot(element) ?? null;
    const own = (element as Element & { openOrClosedShadowRoot?: () => ShadowRoot | null })
      .openOrClosedShadowRoot;
    return typeof own === 'function' ? (own.call(element) ?? null) : null;
  } catch {
    return null;
  }
}

/** Removes hosts an earlier copy of this extension signed; returns how many. */
export function removeStaleKeyMoveHosts(
  value: string,
  read: ReadShadowRoot = openOrClosedShadowRoot,
): number {
  let removed = 0;
  for (const host of document.querySelectorAll(`#${KEYMOVE_ROOT_ID}`)) {
    // KeyMove's hosts have no light-DOM children, so no page content goes with them.
    if (isKeyMoveRoot(host) || host.hasChildNodes() || !host.shadowRoot) continue;
    const signed = [...host.shadowRoot.children].some(
      child => read(child)?.firstElementChild?.getAttribute(SECRET_ATTRIBUTE) === value,
    );
    if (signed) {
      host.remove();
      removed++;
    }
  }
  return removed;
}

/**
 * Once the secret loads, removes what earlier copies left in this document. A live
 * Chromium orphan whose host is removed notices through `alive` before reattaching it.
 */
export function reconcileStaleKeyMoveHosts(alive: () => boolean) {
  void hostMarkerSecret().then(value => {
    if (value && alive()) removeStaleKeyMoveHosts(value);
  });
}
