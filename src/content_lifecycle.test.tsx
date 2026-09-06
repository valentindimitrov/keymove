import React from 'react';
import { act } from '@testing-library/react';
import { KEYMOVE_ROOT_ID } from './constants.js';

const unmount = vi.hoisted(() => vi.fn());

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

test('unmounts React and stops host reattachment when the content context is invalidated', async () => {
  const defineScript = vi.fn((definition: unknown) => definition);
  vi.stubGlobal('defineContentScript', defineScript);
  try {
    await import('../entrypoints/content.js');
    const definition = defineScript.mock.calls[0]![0] as {
      main: (context: { onInvalidated: (callback: () => void) => void }) => void;
    };
    let invalidate: (() => void) | undefined;
    act(() =>
      definition.main({
        onInvalidated: callback => {
          invalidate = callback;
        },
      }),
    );
    expect(
      document.getElementById(KEYMOVE_ROOT_ID)?.shadowRoot?.querySelector('input'),
    ).not.toBeNull();
    act(() => {
      invalidate?.();
    });
    expect(unmount).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(document.getElementById(KEYMOVE_ROOT_ID)).toBeNull();
    document.body.append(document.createElement('p'));
    await Promise.resolve();
    expect(document.getElementById(KEYMOVE_ROOT_ID)).toBeNull();
  } finally {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  }
});
