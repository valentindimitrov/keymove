import { browser } from 'wxt/browser';

/**
 * Content-script lifetime that page script cannot end.
 *
 * WXT retires an older copy of a content script when a newer copy dispatches a
 * `CustomEvent` on the document. Page script shares that document and can forge the
 * event, so KeyMove treats it, and its own started event, only as a hint: a copy
 * tears down when its extension runtime is really gone, which happens when the
 * extension is reloaded, updated, disabled or uninstalled. Page script cannot make
 * `browser.runtime.id` disappear.
 *
 * A copy whose runtime is still valid keeps running. A second copy started in the
 * same isolated world while the first still works (installation-time injection
 * racing the manifest script) does not mount. The record of live copies sits on the
 * isolated world's global object, which page script cannot read or write, and is
 * shared by every bundle evaluation of this extension in the document.
 */

type WxtContext = { onInvalidated(callback: () => void): unknown };
type LiveInstances = Map<string, () => void>;

const LIVE_INSTANCES = Symbol.for('keymove.liveContentScripts');

export function contentScriptStartedEvent(name: string) {
  return `keymove:content-script-started:${name}`;
}

export function extensionContextIsValid(): boolean {
  try {
    // An orphaned Chromium content script keeps running with this undefined.
    const id: unknown = browser.runtime?.id;
    return typeof id === 'string' && id !== '';
  } catch {
    return false;
  }
}

function liveInstances(): LiveInstances {
  const scope = globalThis as unknown as Record<symbol, LiveInstances | undefined>;
  scope[LIVE_INSTANCES] ??= new Map();
  return scope[LIVE_INSTANCES];
}

/**
 * Mounts one copy of the named content script per isolated world and keeps it until
 * its extension context is invalid. `mount` returns its teardown, or nothing when
 * there is nothing to tear down.
 */
export function runSingleContentScript(
  context: WxtContext,
  name: string,
  mount: () => (() => void) | null | undefined | void,
  contextIsValid: () => boolean = extensionContextIsValid,
): void {
  const startedEvent = contentScriptStartedEvent(name);
  // Ask earlier copies to check themselves before looking for one. An orphan in this
  // same world (if a browser ever reuses it after a reload) then retires first.
  document.dispatchEvent(new Event(startedEvent));
  const live = liveInstances();
  if (live.has(name)) return;
  const teardown = mount();
  if (!teardown) return;

  let retired = false;
  const retire = () => {
    if (retired) return;
    retired = true;
    document.removeEventListener(startedEvent, retireIfOrphaned);
    if (live.get(name) === retire) live.delete(name);
    teardown();
  };
  // Deliberately accepts untrusted events: KeyMove's own copies dispatch them from
  // script too. The event only prompts the check; it cannot retire a working copy.
  function retireIfOrphaned() {
    if (!contextIsValid()) retire();
  }
  live.set(name, retire);
  document.addEventListener(startedEvent, retireIfOrphaned);
  // WXT aborts its context once, for a genuine or a forged signal, and stops listening.
  // The document listener above keeps the hint alive for a later genuine replacement.
  context.onInvalidated(retireIfOrphaned);
}
