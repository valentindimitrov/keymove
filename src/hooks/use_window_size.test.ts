import { act, renderHook } from '@testing-library/react';
import useWindowSize from './use_window_size.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('innerWidth', 1000);
  vi.stubGlobal('innerHeight', 800);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('updates viewport dimensions immediately by default', () => {
  const { result } = renderHook(() => useWindowSize());
  expect(result.current).toEqual({ width: 1000, height: 800 });

  act(() => {
    vi.stubGlobal('innerWidth', 1200);
    window.dispatchEvent(new Event('resize'));
  });

  expect(result.current).toEqual({ width: 1200, height: 800 });
});

test('debounces successive resize events using the latest viewport dimensions', () => {
  const { result } = renderHook(() => useWindowSize(100));

  act(() => {
    vi.stubGlobal('innerWidth', 1100);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(50);
    vi.stubGlobal('innerWidth', 1200);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(99);
  });
  expect(result.current.width).toBe(1000);

  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current.width).toBe(1200);
});

test('cancels pending resize work and stops listening on unmount', () => {
  const { unmount } = renderHook(() => useWindowSize(100));
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  expect(vi.getTimerCount()).toBe(1);

  unmount();
  expect(vi.getTimerCount()).toBe(0);

  window.dispatchEvent(new Event('resize'));
  expect(vi.getTimerCount()).toBe(0);
});

test('keeps a viewport change made between the first render and subscription', () => {
  // A resize that fires after the initial read but before the effect subscribes has no
  // listener to receive it, as when a test harness sets the viewport while the page mounts.
  let rendered = false;
  const { result } = renderHook(() => {
    const size = useWindowSize();
    if (!rendered) {
      rendered = true;
      vi.stubGlobal('innerWidth', 360);
    }
    return size;
  });
  expect(result.current.width).toBe(360);
});
