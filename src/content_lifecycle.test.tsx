import React from 'react';
import { act } from '@testing-library/react';
import { KEYMOVE_ROOT_ID } from './constants.js';

const unmount = vi.hoisted(() => vi.fn());
const runtime = vi.hoisted(() => ({ id: 'keymove-test' as string | undefined }));

vi.mock('wxt/browser', () => ({ browser: { runtime } }));

vi.mock('./components/searchbar/searchbar.js', () => ({
  default: function SearchbarStub() {
    React.useEffect(
      () => () => {
        unmount();
      },
      [],
    );
    return <input aria-label="Lifecycle search" />;
  },
}));

type Context = { onInvalidated: (callback: () => void) => () => void };
type Definition = {
  main: (context: Context) => void | Promise<void>;
  noScriptStartedPostMessage?: boolean;
};

// Mirrors WXT's ContentScriptContext: an abort signal whose listeners run once.
function wxtContext() {
  const controller = new AbortController();
  return {
    context: {
      onInvalidated(callback: () => void) {
        controller.signal.addEventListener('abort', callback);
        return () => controller.signal.removeEventListener('abort', callback);
      },
    },
    invalidate: () => controller.abort(),
  };
}

let definition: Definition;
beforeAll(async () => {
  const defineScript = vi.fn((value: unknown) => value);
  vi.stubGlobal('defineContentScript', defineScript);
  await import('../entrypoints/content.js');
  definition = defineScript.mock.calls[0]![0] as Definition;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  // Retire whatever instance the test left running, as a newer instance would.
  runtime.id = undefined;
  act(() => {
    document.dispatchEvent(new Event('keymove:content-script-started:content'));
  });
  runtime.id = 'keymove-test';
  document.body.innerHTML = '';
  unmount.mockClear();
});

// main loads the interface module before mounting, so a start completes asynchronously.
async function start(context: Context) {
  await act(async () => {
    await definition.main(context);
  });
}

const hosts = () => document.querySelectorAll(`#${KEYMOVE_ROOT_ID}`);
const searchInput = () => hosts()[0]?.shadowRoot?.querySelector('input') ?? null;

test('does not announce its startup event type to page script', () => {
  expect(definition.noScriptStartedPostMessage).toBe(true);
});

test('stays mounted when a page forges the content-script replacement signal', async () => {
  const first = wxtContext();
  await start(first.context);
  expect(searchInput()).not.toBeNull();
  // The page forged WXT's started event; the runtime is still valid.
  act(() => first.invalidate());
  act(() => {
    document.dispatchEvent(new Event('keymove:content-script-started:content'));
  });
  expect(unmount).not.toHaveBeenCalled();
  expect(hosts()).toHaveLength(1);
  expect(searchInput()).not.toBeNull();
});

test('an orphaned instance retires for a newer one even after a forged signal', async () => {
  const orphan = wxtContext();
  await start(orphan.context);
  act(() => orphan.invalidate());
  // The extension reloads: this instance's runtime is gone, and a new copy in a fresh
  // isolated world (one mocked runtime here, so it is valid again) announces itself.
  runtime.id = undefined;
  act(() => {
    document.dispatchEvent(new Event('keymove:content-script-started:content'));
  });
  runtime.id = 'keymove-test';
  const newer = wxtContext();
  await start(newer.context);
  expect(unmount).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(hosts()).toHaveLength(1);
  expect(searchInput()).not.toBeNull();
  // The retired instance no longer reattaches its host.
  document.body.append(document.createElement('p'));
  await Promise.resolve();
  expect(hosts()).toHaveLength(1);
});

test('a second working instance in the same document does not mount', async () => {
  await start(wxtContext().context);
  const original = hosts()[0];
  await start(wxtContext().context);
  expect(hosts()).toHaveLength(1);
  expect(hosts()[0]).toBe(original);
  expect(unmount).not.toHaveBeenCalled();
});

test('unmounts React and stops host reattachment once the extension context is gone', async () => {
  const instance = wxtContext();
  await start(instance.context);
  runtime.id = undefined;
  act(() => instance.invalidate());
  expect(unmount).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(hosts()).toHaveLength(0);
  document.body.append(document.createElement('p'));
  await Promise.resolve();
  expect(hosts()).toHaveLength(0);
});

test('an orphan whose hints were all blocked retires instead of reattaching its host', async () => {
  const swallow = (event: Event) => event.stopImmediatePropagation();
  window.addEventListener('keymove:content-script-started:content', swallow, true);
  try {
    const orphan = wxtContext();
    await start(orphan.context);
    act(() => orphan.invalidate());
    // The extension reloads. No hint reaches this copy; a newer copy removes its host.
    runtime.id = undefined;
    act(() => hosts()[0]!.remove());
    await act(() => Promise.resolve());
    expect(unmount).toHaveBeenCalledOnce();
    expect(hosts()).toHaveLength(0);
  } finally {
    window.removeEventListener('keymove:content-script-started:content', swallow, true);
  }
});
