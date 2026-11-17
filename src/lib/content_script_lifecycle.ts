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
 *
 * Page script can block the hints, so an orphan also checks itself whenever it would
 * act: before KeyMove's own input listeners, on visibility and focus changes, from code
 * that calls the `alive` callback, and on a slow timer while the page is visible.
 */

type WxtContext = { onInvalidated(callback: () => void): unknown };
type LiveCopy = { isValid(): boolean; retire(): void };
type LiveInstances = Map<string, LiveCopy>;

const LIVE_INSTANCES = Symbol.for('keymove.liveContentScripts');

/**
 * Input that KeyMove's handlers may intercept. An orphan checks itself on window capture,
 * before any of its own document or shadow-root listeners, so it never swallows input.
 */
const INPUT_EVENTS = [
  'keydown',
  'keyup',
  'keypress',
  'beforeinput',
  'input',
  'compositionstart',
  'copy',
  'cut',
  'paste',
  'pointerdown',
  'mousedown',
  'click',
  'focus',
] as const;

/**
 * Fallback for an orphan on a page nobody touches: no input, focus, visibility change or
 * DOM mutation, each of which already makes it check. It runs only while the document is
 * visible, so hidden tabs never wake for it; a visible page costs one property read per
 * minute per KeyMove frame. A tab coming back into view checks at once. A minute bounds
 * how long a stale bar can stay on screen on an untouched page.
 */
export const ORPHAN_CHECK_INTERVAL_MS = 60_000;

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

/** Retires every copy in this isolated world whose extension context is gone. */
function retireOrphans(live: LiveInstances) {
  for (const [name, copy] of [...live]) {
    // A record this bundle cannot use must not block mounting forever.
    if (typeof copy?.isValid !== 'function' || typeof copy.retire !== 'function') live.delete(name);
    else if (!copy.isValid()) copy.retire();
  }
}

/**
 * Mounts one copy of the named content script per isolated world and keeps it until
 * its extension context is invalid. `mount` returns its teardown, or nothing when
 * there is nothing to tear down. It receives `alive`, which the copy calls wherever it
 * already runs code (DOM observers, failed extension calls): it retires the copy and
 * returns false once the extension context is gone.
 */
export function runSingleContentScript(
  context: WxtContext,
  name: string,
  mount: (alive: () => boolean) => (() => void) | null | undefined | void,
  contextIsValid: () => boolean = extensionContextIsValid,
): void {
  const startedEvent = contentScriptStartedEvent(name);
  // Ask earlier copies to check themselves before looking for one. An orphan in another
  // world can only hear this hint; one in this world (if a browser ever reuses it after a
  // reload) is retired directly, since page script can block the hint.
  document.dispatchEvent(new Event(startedEvent));
  const live = liveInstances();
  retireOrphans(live);
  if (live.has(name)) return;

  let retired = false;
  let teardown: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const alive = () => {
    if (!retired && !contextIsValid()) retire();
    return !retired;
  };
  // Deliberately accepts untrusted events: KeyMove's own copies dispatch the hint from
  // script, and any event only prompts the check. It cannot retire a working copy.
  const check = () => {
    alive();
  };
  const schedule = () => {
    clearInterval(timer);
    timer =
      document.visibilityState === 'visible'
        ? setInterval(check, ORPHAN_CHECK_INTERVAL_MS)
        : undefined;
  };
  const visibilityChanged = () => {
    if (alive()) schedule();
  };
  const copy: LiveCopy = { isValid: contextIsValid, retire };
  function retire() {
    if (retired) return;
    retired = true;
    clearInterval(timer);
    document.removeEventListener(startedEvent, check);
    document.removeEventListener('visibilitychange', visibilityChanged);
    window.removeEventListener('pageshow', check);
    for (const type of INPUT_EVENTS) window.removeEventListener(type, check, true);
    if (live.get(name) === copy) live.delete(name);
    teardown?.();
  }

  // Listen before mounting so the checks run ahead of every listener the copy adds.
  live.set(name, copy);
  for (const type of INPUT_EVENTS) window.addEventListener(type, check, true);
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', visibilityChanged);
  document.addEventListener(startedEvent, check);
  let mounted: ReturnType<typeof mount>;
  try {
    mounted = mount(alive);
  } catch (error) {
    // Unregister, or the failed copy would stop every later copy from mounting.
    retire();
    throw error;
  }
  if (!mounted) return retire();
  // An orphan noticed during mount has already unregistered; undo what mount built.
  if (retired) return mounted();
  teardown = mounted;
  schedule();
  // WXT aborts its context once, for a genuine or a forged signal, and stops listening.
  // The checks above keep working for a later genuine replacement.
  context.onInvalidated(check);
}
