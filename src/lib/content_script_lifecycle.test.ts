import {
  contentScriptStartedEvent,
  ORPHAN_CHECK_INTERVAL_MS,
  runSingleContentScript,
} from './content_script_lifecycle.js';

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

/** A copy whose mount listens for keydown on the document, as KeyMove's handlers do. */
function startListening(name: string) {
  const state = { valid: true, tornDown: 0, keys: 0 };
  let alive = () => true;
  const onKey = () => state.keys++;
  runSingleContentScript(
    wxtContext().context,
    name,
    isAlive => {
      alive = isAlive;
      document.addEventListener('keydown', onKey, true);
      return () => {
        state.tornDown++;
        document.removeEventListener('keydown', onKey, true);
      };
    },
    () => state.valid,
  );
  return { state, alive: () => alive() };
}

describe('an orphan notices by itself, without any page-deliverable hint', () => {
  test('before its own handlers see the next keystroke', () => {
    const orphan = track(startListening('lifecycle-test'));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    expect(orphan.state).toMatchObject({ keys: 1, tornDown: 0 });
    orphan.state.valid = false;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    // Retired on window capture, so the keystroke never reached its document listener.
    expect(orphan.state).toMatchObject({ keys: 1, tornDown: 1 });
  });

  test.each([
    ['focus', () => window.dispatchEvent(new FocusEvent('focus'))],
    ['visibility change', () => document.dispatchEvent(new Event('visibilitychange'))],
    [
      'pointer input',
      () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })),
    ],
  ])('on %s', (_, happen) => {
    const orphan = track(startListening('lifecycle-test'));
    happen();
    expect(orphan.state.tornDown).toBe(0);
    orphan.state.valid = false;
    happen();
    expect(orphan.state.tornDown).toBe(1);
  });

  test('when its own code asks, for example from a DOM observer', () => {
    const copy = track(startListening('lifecycle-test'));
    expect(copy.alive()).toBe(true);
    copy.state.valid = false;
    expect(copy.alive()).toBe(false);
    expect(copy.state.tornDown).toBe(1);
    expect(copy.alive()).toBe(false);
    expect(copy.state.tornDown).toBe(1);
  });

  test('on an idle visible page, by a fallback check that hidden pages never schedule', () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    try {
      visibility.mockReturnValue('hidden');
      const hidden = track(startListening('lifecycle-test'));
      expect(vi.getTimerCount()).toBe(0);
      hidden.state.valid = false;
      visibility.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(hidden.state.tornDown).toBe(1);
      expect(vi.getTimerCount()).toBe(0);

      const idle = track(startListening('lifecycle-test'));
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(ORPHAN_CHECK_INTERVAL_MS);
      expect(idle.state.tornDown).toBe(0);
      idle.state.valid = false;
      vi.advanceTimersByTime(ORPHAN_CHECK_INTERVAL_MS);
      expect(idle.state.tornDown).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });

  test('a new copy retires an orphan in its own world even when the page swallowed the hint', () => {
    const swallow = (event: Event) => event.stopImmediatePropagation();
    window.addEventListener(contentScriptStartedEvent('lifecycle-test'), swallow, true);
    try {
      const orphan = track(start('lifecycle-test'));
      orphan.invalidate();
      orphan.state.valid = false;
      const newer = track(start('lifecycle-test'));
      expect(orphan.state.tornDown).toBe(1);
      expect(newer.state.mounted).toBe(1);
    } finally {
      window.removeEventListener(contentScriptStartedEvent('lifecycle-test'), swallow, true);
    }
  });
});

test('a copy whose mount failed does not stop a later copy from mounting', () => {
  expect(() =>
    runSingleContentScript(wxtContext().context, 'lifecycle-test', () => {
      throw new Error('mount failed');
    }),
  ).toThrow('mount failed');
  const next = track(start('lifecycle-test'));
  expect(next.state.mounted).toBe(1);
});
