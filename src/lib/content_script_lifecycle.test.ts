import { contentScriptStartedEvent, runSingleContentScript } from './content_script_lifecycle.js';

// Mirrors WXT's ContentScriptContext: an abort signal whose listeners run once.
function wxtContext() {
  const controller = new AbortController();
  return {
    context: {
      onInvalidated: (callback: () => void) =>
        controller.signal.addEventListener('abort', callback),
    },
    invalidate: () => controller.abort(),
  };
}

/** One copy of the named script, with its own extension-context validity. */
function start(name: string) {
  const state = { valid: true, mounted: 0, tornDown: 0 };
  const wxt = wxtContext();
  runSingleContentScript(
    wxt.context,
    name,
    () => {
      state.mounted++;
      return () => state.tornDown++;
    },
    () => state.valid,
  );
  return { state, invalidate: wxt.invalidate };
}

const hint = (name: string) => document.dispatchEvent(new Event(contentScriptStartedEvent(name)));

const running: { state: { valid: boolean } }[] = [];
function track<T extends { state: { valid: boolean } }>(copy: T) {
  running.push(copy);
  return copy;
}
afterEach(() => {
  for (const copy of running.splice(0)) copy.state.valid = false;
  hint('lifecycle-test');
  hint('other-test');
});

test('page-dispatched signals cannot retire a copy whose extension context is valid', () => {
  const copy = track(start('lifecycle-test'));
  copy.invalidate();
  hint('lifecycle-test');
  document.dispatchEvent(
    new CustomEvent(contentScriptStartedEvent('lifecycle-test'), { detail: { forged: true } }),
  );
  expect(copy.state).toMatchObject({ mounted: 1, tornDown: 0 });
});

test('an orphaned copy retires on the next hint, even after WXT stopped listening', () => {
  const orphan = track(start('lifecycle-test'));
  orphan.invalidate();
  orphan.state.valid = false;
  expect(orphan.state.tornDown).toBe(0);
  const newer = track(start('lifecycle-test'));
  expect(orphan.state.tornDown).toBe(1);
  expect(newer.state.mounted).toBe(1);
  // Teardown runs once; the retired copy no longer listens.
  hint('lifecycle-test');
  expect(orphan.state.tornDown).toBe(1);
});

test('WXT invalidation retires the copy only when its extension context is gone', () => {
  const copy = track(start('lifecycle-test'));
  copy.state.valid = false;
  copy.invalidate();
  expect(copy.state.tornDown).toBe(1);
});

test('a second working copy does not mount until the first has retired', () => {
  const first = track(start('lifecycle-test'));
  const second = track(start('lifecycle-test'));
  expect(second.state.mounted).toBe(0);
  expect(first.state.tornDown).toBe(0);
  first.state.valid = false;
  hint('lifecycle-test');
  const third = track(start('lifecycle-test'));
  expect(third.state.mounted).toBe(1);
});

test('copies of different scripts are independent', () => {
  const content = track(start('lifecycle-test'));
  const frames = track(start('other-test'));
  expect(frames.state.mounted).toBe(1);
  content.state.valid = false;
  hint('lifecycle-test');
  expect(content.state.tornDown).toBe(1);
  expect(frames.state.tornDown).toBe(0);
});
