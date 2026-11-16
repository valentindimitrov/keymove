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
type Definition = { main: (context: Context) => void; noScriptStartedPostMessage?: boolean };

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

const hosts = () => document.querySelectorAll(`#${KEYMOVE_ROOT_ID}`);
const searchInput = () => hosts()[0]?.shadowRoot?.querySelector('input') ?? null;

test('does not announce its startup event type to page script', () => {
  expect(definition.noScriptStartedPostMessage).toBe(true);
});

test('stays mounted when a page forges the content-script replacement signal', () => {
  const first = wxtContext();
  act(() => definition.main(first.context));
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
  act(() => definition.main(orphan.context));
  act(() => orphan.invalidate());
  // The extension reloads: this instance's runtime is gone and a new copy starts.
  runtime.id = undefined;
  const newer = wxtContext();
  act(() => definition.main(newer.context));
  runtime.id = 'keymove-test';
  expect(unmount).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(hosts()).toHaveLength(1);
  expect(searchInput()).not.toBeNull();
  // The retired instance no longer reattaches its host.
  document.body.append(document.createElement('p'));
  await Promise.resolve();
  expect(hosts()).toHaveLength(1);
});

test('a second working instance in the same document does not mount', () => {
  act(() => definition.main(wxtContext().context));
  const original = hosts()[0];
  act(() => definition.main(wxtContext().context));
  expect(hosts()).toHaveLength(1);
  expect(hosts()[0]).toBe(original);
  expect(unmount).not.toHaveBeenCalled();
});

test('unmounts React and stops host reattachment once the extension context is gone', async () => {
  const instance = wxtContext();
  act(() => definition.main(instance.context));
  runtime.id = undefined;
  act(() => instance.invalidate());
  expect(unmount).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(hosts()).toHaveLength(0);
  document.body.append(document.createElement('p'));
  await Promise.resolve();
  expect(hosts()).toHaveLength(0);
});
