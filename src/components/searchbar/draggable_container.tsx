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
type ResizeOrigin = { pointerX: number; width: number; left: number };

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

  // Resizing keeps the left edge still and moves the centre, which is what the stored
  // position actually records. Both are committed once on release rather than on every
  // pixel of the drag, the same way moving the bar does.
  const startResize = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const left = pixelPosition(
        currentPositionRef.current,
        windowSize.width,
        windowSize.height,
        currentWidth,
      ).left;
      setResizeOrigin({ pointerX: event.clientX, width: currentWidth, left });
    },
    [windowSize, currentWidth],
  );

  const resize = React.useCallback(
    (event: MouseEvent) => {
      if (!resizeOrigin) return;
      event.preventDefault();
      const nextWidth = clampWidth(
        Math.min(
          resizeOrigin.width + (event.clientX - resizeOrigin.pointerX),
          Math.max(MIN_CONTAINER_WIDTH, windowSize.width - resizeOrigin.left),
        ),
      );
      currentWidthRef.current = nextWidth;
      setCurrentWidth(nextWidth);
      const nextPosition = normalizedPosition(
        resizeOrigin.left,
        pixelPosition(currentPositionRef.current, windowSize.width, windowSize.height, nextWidth)
          .top,
        windowSize.width,
        windowSize.height,
        nextWidth,
      );
      currentPositionRef.current = nextPosition;
      setCurrentPosition(nextPosition);
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
        className={'keymove-resize-handle'}
        role="separator"
        aria-orientation="vertical"
        aria-label={'Resize KeyMove'}
        onMouseDown={startResize}
      />
    </div>
  );
};

export default DraggableContainer;
export { normalizedPosition, pixelPosition };
