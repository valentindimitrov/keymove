import React from 'react';
import {
  KEYMOVE_CONTAINER_HEIGHT,
  KEYMOVE_CONTAINER_WIDTH,
  MIN_CONTAINER_WIDTH,
} from '../../constants.js';
import { clampWidth } from '../../lib/popup_width_schema.js';
import useWindowSize from '../../hooks/use_window_size.js';
import type { PopupPosition } from '../../lib/popup_position_schema.js';

import Utils from '../../lib/utils.js';

type DragOffset = { x: number; y: number };
type ResizeEdge = -1 | 1;
type ResizeOrigin = { pointerX: number; width: number; center: number; edge: ResizeEdge };

type DraggableContainerProps = React.PropsWithChildren<{
  className?: string | undefined;
  locked?: boolean;
  bottomContentHeight?: number;
  width: number;
  updateWidth: (width: number) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  position: PopupPosition;
  updatePosition: (position: PopupPosition) => void;
}>;

function pixelPosition(
  position: PopupPosition,
  viewportWidth: number,
  viewportHeight: number,
  width: number = KEYMOVE_CONTAINER_WIDTH,
  bottomContentHeight = 0,
) {
  return {
    left: Utils.clampNumber(
      position.x * viewportWidth - width / 2,
      0,
      Math.max(0, viewportWidth - width),
    ),
    top: Utils.clampNumber(
      position.y * viewportHeight - KEYMOVE_CONTAINER_HEIGHT / 2,
      0,
      Math.max(0, viewportHeight - KEYMOVE_CONTAINER_HEIGHT - bottomContentHeight),
    ),
  };
}

function normalizedPosition(
  left: number,
  top: number,
  viewportWidth: number,
  viewportHeight: number,
  width: number = KEYMOVE_CONTAINER_WIDTH,
) {
  const safeViewportWidth = Math.max(viewportWidth, 1);
  const safeViewportHeight = Math.max(viewportHeight, 1);
  return {
    x: Utils.clampNumber((left + width / 2) / safeViewportWidth, 0, 1),
    y: Utils.clampNumber((top + KEYMOVE_CONTAINER_HEIGHT / 2) / safeViewportHeight, 0, 1),
  };
}

const DraggableContainer = (props: DraggableContainerProps) => {
  const { children, className, searchInputRef, containerRef, position, updatePosition } = props;
  const { width, updateWidth, locked = false, bottomContentHeight = 0 } = props;
  const windowSize = useWindowSize();

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState<DragOffset | null>(null);
  const [currentPosition, setCurrentPosition] = React.useState(position);
  const [currentWidth, setCurrentWidth] = React.useState(width);
  // Fit the current viewport without discarding the user's preferred size. Geometry for
  // dragging and resizing must use the same width the user actually sees.
  const renderedWidth = Math.min(currentWidth, Math.max(0, windowSize.width));
  const [resizeOrigin, setResizeOrigin] = React.useState<ResizeOrigin | null>(null);
  const currentWidthRef = React.useRef(currentWidth);

  // Follows a width set elsewhere, such as a reset from the extension popup. Keyed on the
  // incoming value rather than on the drag ending, so releasing the handle does not snap the
  // bar back to the old width while the new one is still on its way to storage.
  const lastWidthProp = React.useRef(width);
  React.useEffect(() => {
    if (width === lastWidthProp.current) return;
    lastWidthProp.current = width;
    currentWidthRef.current = width;
    setCurrentWidth(width);
  }, [width]);
  const currentPositionRef = React.useRef(position);

  // A lock arriving from another tab cancels any unfinished gesture. Restore the saved
  // geometry rather than letting its eventual mouseup persist a partial drag or resize.
  React.useLayoutEffect(() => {
    if (!locked) return;
    setIsDragging(false);
    setDragOffset(null);
    setResizeOrigin(null);
    currentPositionRef.current = position;
    currentWidthRef.current = width;
    setCurrentPosition(position);
    setCurrentWidth(width);
  }, [locked, position, width]);

  React.useEffect(() => {
    currentPositionRef.current = position;
    setCurrentPosition(position);
  }, [position]);

  const onDragStart = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (locked) return;
      const target = event.target;
      if (target instanceof Element && target.closest('button, a')) {
        return;
      }
      // Empty inputs still need the browser's native click-to-focus behavior.
      // Dragging here cancels mousedown, and document mouseup sees the shadow host.
      if (event.target !== searchInputRef.current && !event.metaKey) {
        event.preventDefault();
        const currentPixels = pixelPosition(
          currentPosition,
          windowSize.width,
          windowSize.height,
          renderedWidth,
        );
        setDragOffset({
          x: event.clientX - currentPixels.left,
          y: event.clientY - currentPixels.top,
        });
        setIsDragging(true);
      }
    },
    [currentPosition, renderedWidth, searchInputRef, windowSize, locked],
  );

  const onDragEnd = React.useCallback(
    (event: MouseEvent) => {
      if (locked) return;
      setIsDragging(false);
      updatePosition(currentPositionRef.current);
      if (event.target === searchInputRef.current) {
        searchInputRef.current?.focus();
      }
    },
    [searchInputRef, updatePosition, locked],
  );

  const drag = React.useCallback(
    (event: MouseEvent) => {
      if (locked) return;
      event.preventDefault();
      if (!dragOffset) {
        return;
      }
      const left = Utils.clampNumber(
        event.clientX - dragOffset.x,
        0,
        Math.max(0, windowSize.width - renderedWidth),
      );
      const top = Utils.clampNumber(
        event.clientY - dragOffset.y,
        0,
        Math.max(0, windowSize.height - KEYMOVE_CONTAINER_HEIGHT),
      );
      const nextPosition = normalizedPosition(
        left,
        top,
        windowSize.width,
        windowSize.height,
        renderedWidth,
      );
      currentPositionRef.current = nextPosition;
      setCurrentPosition(nextPosition);
    },
    [dragOffset, windowSize, renderedWidth, locked],
  );

  // Resizing pins the centre and moves both edges, so either handle grows the bar the same
  // way and the bar stays where it was put. The pointer therefore travels half of what the
  // width gains, which is why the distance dragged is doubled below. The size is committed
  // once on release rather than on every pixel of the drag, the same way moving the bar does.
  const startResize = React.useCallback(
    (edge: ResizeEdge) => (event: React.MouseEvent) => {
      if (locked) return;
      event.preventDefault();
      event.stopPropagation();
      const left = pixelPosition(
        currentPositionRef.current,
        windowSize.width,
        windowSize.height,
        renderedWidth,
      ).left;
      // The rendered centre, not the stored one: a bar against a viewport edge is clamped,
      // and anchoring to the stored value would slide it as the width changed.
      const center = left + renderedWidth / 2;
      const anchored = {
        x: Utils.clampNumber(center / Math.max(windowSize.width, 1), 0, 1),
        y: currentPositionRef.current.y,
      };
      currentPositionRef.current = anchored;
      setCurrentPosition(anchored);
      setResizeOrigin({ pointerX: event.clientX, width: renderedWidth, center, edge });
    },
    [windowSize, renderedWidth, locked],
  );

  const resize = React.useCallback(
    (event: MouseEvent) => {
      if (locked || !resizeOrigin) return;
      event.preventDefault();
      const travel = (event.clientX - resizeOrigin.pointerX) * resizeOrigin.edge;
      // Growing symmetrically means the nearer viewport edge is what runs out first.
      const room = 2 * Math.min(resizeOrigin.center, windowSize.width - resizeOrigin.center);
      const nextWidth = clampWidth(
        Math.min(resizeOrigin.width + travel * 2, Math.max(MIN_CONTAINER_WIDTH, room)),
      );
      currentWidthRef.current = nextWidth;
      setCurrentWidth(nextWidth);
    },
    [resizeOrigin, windowSize, locked],
  );

  const onResizeEnd = React.useCallback(() => {
    if (locked) return;
    setResizeOrigin(null);
    updateWidth(currentWidthRef.current);
    updatePosition(currentPositionRef.current);
  }, [updateWidth, updatePosition, locked]);

  React.useLayoutEffect(() => {
    if (!locked && resizeOrigin) {
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', onResizeEnd);
      return () => {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', onResizeEnd);
      };
    }
    return undefined;
  }, [locked, resizeOrigin, resize, onResizeEnd]);

  React.useLayoutEffect(() => {
    if (!locked && isDragging) {
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', onDragEnd);

      return () => {
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', onDragEnd);
      };
    }
    return undefined;
  }, [locked, isDragging, drag, onDragEnd]);

  const containerStyle = React.useMemo(() => {
    return {
      ...pixelPosition(
        currentPosition,
        windowSize.width,
        windowSize.height,
        renderedWidth,
        bottomContentHeight,
      ),
      width: renderedWidth,
      // The upward menu must not lift the search bar by the row that now stays beneath it.
      transform:
        bottomContentHeight > 0 && className?.includes('keymove-container-suggestions-above')
          ? `translateY(calc(-100% + ${KEYMOVE_CONTAINER_HEIGHT + bottomContentHeight}px))`
          : undefined,
    };
  }, [currentPosition, windowSize, renderedWidth, bottomContentHeight, className]);

  return (
    <div
      id={'keymove-container'}
      className={className}
      data-layout-locked={locked}
      style={containerStyle}
      onMouseDown={onDragStart}
      ref={containerRef}
    >
      {children}
      {!locked && (
        <>
          <div
            className={'keymove-resize-handle keymove-resize-handle-left'}
            role="separator"
            aria-orientation="vertical"
            aria-label={'Resize KeyMove from the left'}
            onMouseDown={startResize(-1)}
          />
          <div
            className={'keymove-resize-handle keymove-resize-handle-right'}
            role="separator"
            aria-orientation="vertical"
            aria-label={'Resize KeyMove from the right'}
            onMouseDown={startResize(1)}
          />
        </>
      )}
    </div>
  );
};

export default DraggableContainer;
export { normalizedPosition, pixelPosition };
