import React from 'react';
import { KEYMOVE_CONTAINER_HEIGHT, KEYMOVE_CONTAINER_WIDTH } from '../../constants.js';
import { widthAboutCenter } from '../../lib/popup_width_schema.js';
import useWindowSize from '../../hooks/use_window_size.js';
import type { PopupPosition } from '../../lib/popup_position_schema.js';

import Utils from '../../lib/utils.js';

type DragOffset = { x: number; y: number };
type ResizeEdge = -1 | 1;
type ResizeOrigin = { pointerX: number; width: number; center: number; edge: ResizeEdge };

type DraggableContainerProps = React.PropsWithChildren<{
  className?: string | undefined;
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
      Math.max(0, viewportHeight - KEYMOVE_CONTAINER_HEIGHT),
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
  const { width, updateWidth } = props;
  const windowSize = useWindowSize();

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState<DragOffset | null>(null);
  const [currentPosition, setCurrentPosition] = React.useState(position);
  const [currentWidth, setCurrentWidth] = React.useState(width);
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

  React.useEffect(() => {
    currentPositionRef.current = position;
    setCurrentPosition(position);
  }, [position]);

  const onDragStart = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button, a')) {
        return;
      }
      if (
        !(event.target === searchInputRef.current && searchInputRef.current.value.length > 0) &&
        !event.metaKey
      ) {
        event.preventDefault();
        const currentPixels = pixelPosition(currentPosition, windowSize.width, windowSize.height);
        setDragOffset({
          x: event.clientX - currentPixels.left,
          y: event.clientY - currentPixels.top,
        });
        setIsDragging(true);
      }
    },
    [currentPosition, searchInputRef, windowSize],
  );

  const onDragEnd = React.useCallback(
    (event: MouseEvent) => {
      setIsDragging(false);
      updatePosition(currentPositionRef.current);
      if (event.target === searchInputRef.current) {
        searchInputRef.current?.focus();
      }
    },
    [searchInputRef, updatePosition],
  );

  const drag = React.useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      if (!dragOffset) {
        return;
      }
      const left = Utils.clampNumber(
        event.clientX - dragOffset.x,
        0,
        Math.max(0, windowSize.width - width),
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
        width,
      );
      currentPositionRef.current = nextPosition;
      setCurrentPosition(nextPosition);
    },
    [dragOffset, windowSize, width],
  );

  // Resizing pins the centre and moves both edges, so either handle grows the bar the same
  // way and the bar stays where it was put. The pointer therefore travels half of what the
  // width gains, which is why the distance dragged is doubled below. The size is committed
  // once on release rather than on every pixel of the drag, the same way moving the bar does.
  const startResize = React.useCallback(
    (edge: ResizeEdge) => (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const left = pixelPosition(
        currentPositionRef.current,
        windowSize.width,
        windowSize.height,
        currentWidth,
      ).left;
      // The rendered centre, not the stored one: a bar against a viewport edge is clamped,
      // and anchoring to the stored value would slide it as the width changed.
      const center = left + currentWidth / 2;
      const anchored = {
        x: Utils.clampNumber(center / Math.max(windowSize.width, 1), 0, 1),
        y: currentPositionRef.current.y,
      };
      currentPositionRef.current = anchored;
      setCurrentPosition(anchored);
      setResizeOrigin({ pointerX: event.clientX, width: currentWidth, center, edge });
    },
    [windowSize, currentWidth],
  );

  const resize = React.useCallback(
    (event: MouseEvent) => {
      if (!resizeOrigin) return;
      event.preventDefault();
      const travel = (event.clientX - resizeOrigin.pointerX) * resizeOrigin.edge;
      const nextWidth = widthAboutCenter(
        resizeOrigin.width + travel * 2,
        resizeOrigin.center,
        windowSize.width,
      );
      currentWidthRef.current = nextWidth;
      setCurrentWidth(nextWidth);
    },
    [resizeOrigin, windowSize],
  );

  const onResizeEnd = React.useCallback(() => {
    setResizeOrigin(null);
    updateWidth(currentWidthRef.current);
    updatePosition(currentPositionRef.current);
  }, [updateWidth, updatePosition]);

  React.useEffect(() => {
    if (resizeOrigin) {
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', onResizeEnd);
      return () => {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', onResizeEnd);
      };
    }
    return undefined;
  }, [resizeOrigin, resize, onResizeEnd]);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', onDragEnd);

      return () => {
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', onDragEnd);
      };
    }
    return undefined;
  }, [isDragging, drag, onDragEnd]);

  const containerStyle = React.useMemo(() => {
    return {
      ...pixelPosition(currentPosition, windowSize.width, windowSize.height, currentWidth),
      width: currentWidth,
    };
  }, [currentPosition, windowSize, currentWidth]);

  return (
    <div
      id={'keymove-container'}
      className={className}
      style={containerStyle}
      onMouseDown={onDragStart}
      ref={containerRef}
    >
      {children}
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
    </div>
  );
};

export default DraggableContainer;
export { normalizedPosition, pixelPosition };
