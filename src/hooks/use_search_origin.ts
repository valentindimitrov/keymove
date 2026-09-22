import React from 'react';
import { renderedParent } from '../lib/dom_tree.js';
import { frameTarget } from '../lib/frame_target.js';
import { restoreFrameOrigins } from '../lib/find_in_page.js';

type Position = { left: number; top: number };
type SearchOrigin = Position & { containers: Map<Element, Position> };

/** One return position for the current search, captured before KeyMove moves the page. */
function useSearchOrigin() {
  const origin = React.useRef<SearchOrigin | null>(null);

  const remember = React.useCallback((node?: Element) => {
    if (node) node = frameTarget(node)?.boundary ?? node;
    origin.current ??= {
      left: window.scrollX,
      top: window.scrollY,
      containers: new Map(),
    };
    // Only visit a result's ancestors, never scan the page for scrolling containers.
    // Save each container once, before either native selection or scrollIntoView moves it.
    for (let current: Element | null = node ?? null; current;) {
      if (
        current !== document.documentElement &&
        current !== document.body &&
        !origin.current.containers.has(current)
      )
        origin.current.containers.set(current, {
          left: current.scrollLeft,
          top: current.scrollTop,
        });
      current = renderedParent(current);
    }
  }, []);

  const discard = React.useCallback(() => {
    origin.current = null;
  }, []);

  const restore = React.useCallback(() => {
    restoreFrameOrigins();
    const saved = origin.current;
    origin.current = null;
    if (!saved) return;
    for (const [container, position] of saved.containers) {
      if (
        container.isConnected &&
        (container.scrollLeft !== position.left || container.scrollTop !== position.top)
      ) {
        container.scrollTo({ ...position, behavior: 'instant' });
      }
    }
    window.scrollTo({ left: saved.left, top: saved.top, behavior: 'instant' });
  }, []);

  return { remember, discard, restore };
}

export default useSearchOrigin;
