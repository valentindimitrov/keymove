import { renderHook } from '@testing-library/react';
import useSearchOrigin from './use_search_origin.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

test('returns each nested scroll container to its first position across multiple jumps', () => {
  const outer = document.createElement('div');
  const inner = document.createElement('div');
  const first = document.createElement('p');
  const second = document.createElement('p');
  document.body.append(outer);
  outer.append(inner);
  inner.append(first, second);
  outer.scrollTop = 100;
  inner.scrollLeft = 40;
  outer.scrollTo = vi.fn();
  inner.scrollTo = vi.fn();
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('scrollY', 200);
  const { result } = renderHook(() => useSearchOrigin());
  result.current.remember(first);
  outer.scrollTop = 400;
  inner.scrollLeft = 80;
  result.current.remember(second);
  vi.stubGlobal('scrollY', 1000);
  result.current.restore();
  expect(outer.scrollTo).toHaveBeenCalledWith({ top: 100, left: 0, behavior: 'instant' });
  expect(inner.scrollTo).toHaveBeenCalledWith({ top: 0, left: 40, behavior: 'instant' });
  expect(scrollTo).toHaveBeenCalledWith({ top: 200, left: 0, behavior: 'instant' });
  result.current.restore();
  expect(scrollTo).toHaveBeenCalledOnce();
});

test('tracks scrolling across an open shadow root and skips removed containers', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  const match = document.createElement('p');
  root.append(container);
  container.append(match);
  host.scrollTo = vi.fn();
  container.scrollTo = vi.fn();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const { result } = renderHook(() => useSearchOrigin());
  result.current.remember(match);
  host.scrollTop = 90;
  container.scrollTop = 150;
  container.remove();
  result.current.restore();
  expect(host.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  expect(container.scrollTo).not.toHaveBeenCalled();
});

test('discarding a search releases its origin and lets the next search start elsewhere', () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const { result } = renderHook(() => useSearchOrigin());
  result.current.remember();
  result.current.discard();
  result.current.restore();
  expect(scrollTo).not.toHaveBeenCalled();
  vi.stubGlobal('scrollY', 400);
  result.current.remember();
  vi.stubGlobal('scrollY', 800);
  result.current.restore();
  expect(scrollTo).toHaveBeenCalledWith({ top: 400, left: 0, behavior: 'instant' });
});
