import React from 'react';
import { KEYMOVE_CONTAINER_HEIGHT, KEYMOVE_CONTAINER_WIDTH } from '../../constants.js';
import useWindowSize from '../../hooks/use_window_size.js';
import type { PopupPosition } from '../../lib/popup_position_schema.js';

import Utils from '../../lib/utils.js';

type DragOffset = { x: number; y: number };
type DraggableContainerProps = React.PropsWithChildren<{
  className?: string | undefined;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  position: PopupPosition;
  updatePosition: (position: PopupPosition) => void;
}>;

function pixelPosition(position: PopupPosition, viewportWidth: number, viewportHeight: number) {
  return {
    left: Utils.clampNumber(
      position.x * viewportWidth - KEYMOVE_CONTAINER_WIDTH / 2,
      0,
      Math.max(0, viewportWidth - KEYMOVE_CONTAINER_WIDTH),
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
) {
  const safeViewportWidth = Math.max(viewportWidth, 1);
  const safeViewportHeight = Math.max(viewportHeight, 1);
  return {
    x: Utils.clampNumber((left + KEYMOVE_CONTAINER_WIDTH / 2) / safeViewportWidth, 0, 1),
    y: Utils.clampNumber((top + KEYMOVE_CONTAINER_HEIGHT / 2) / safeViewportHeight, 0, 1),
  };
}

const DraggableContainer = (props: DraggableContainerProps) => {
  const { children, className, searchInputRef, containerRef, position, updatePosition } = props;
  const windowSize = useWindowSize();

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState<DragOffset | null>(null);
  const [currentPosition, setCurrentPosition] = React.useState(position);
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
        Math.max(0, windowSize.width - KEYMOVE_CONTAINER_WIDTH),
      );
      const top = Utils.clampNumber(
        event.clientY - dragOffset.y,
        0,
        Math.max(0, windowSize.height - KEYMOVE_CONTAINER_HEIGHT),
      );
      const nextPosition = normalizedPosition(left, top, windowSize.width, windowSize.height);
      currentPositionRef.current = nextPosition;
      setCurrentPosition(nextPosition);
    },
    [dragOffset, windowSize],
  );

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
      ...pixelPosition(currentPosition, windowSize.width, windowSize.height),
      width: KEYMOVE_CONTAINER_WIDTH,
    };
  }, [currentPosition, windowSize]);

  return (
    <div
      id={'keymove-container'}
      className={className}
      style={containerStyle}
      onMouseDown={onDragStart}
      ref={containerRef}
    >
      {children}
    </div>
  );
};

export default DraggableContainer;
export { normalizedPosition, pixelPosition };
