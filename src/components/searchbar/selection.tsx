import React from 'react';
import { rgbaForHexColor } from '../../lib/highlight_colors_schema.js';

const SELECTION_MARGIN = 7;

// A dark hairline just outside the border and a light ring outside the glow. Whichever of
// the two contrasts with the page carries the outline, so the accent is free to signal
// which mode is active instead of having to be legible against every background.
function outlineShadow(color: string) {
  return [
    '0 0 0 1px rgba(0, 0, 0, 0.5)',
    `0 0 0 5px ${rgbaForHexColor(color, 0.26)}`,
    '0 0 0 6px rgba(255, 255, 255, 0.4)',
  ].join(', ');
}

type SelectionProps = { node: Element; isSelected: boolean; color: string };

const Selection = (props: SelectionProps) => {
  const { node, isSelected, color } = props;

  const classes = isSelected ? 'keymove-selection keymove-selected-selection' : 'keymove-selection';

  const nodeBounds = React.useMemo(() => node.getBoundingClientRect(), [node]);

  const style = React.useMemo(() => {
    const left = nodeBounds.left - SELECTION_MARGIN;
    const top = nodeBounds.top - SELECTION_MARGIN;
    // Clamp the selected outline to the viewport without shifting it away from the result.
    const maximizedLeft = isSelected ? Math.max(0, left) : left;
    const maximizedTop = isSelected ? Math.max(0, top) : top;

    const maximizedTopDifference = maximizedTop - top;
    const maximizedLeftDifference = maximizedLeft - left;

    const requestedHeight = nodeBounds.height + 2 * SELECTION_MARGIN - maximizedTopDifference;
    const requestedWidth = nodeBounds.width + 2 * SELECTION_MARGIN - maximizedLeftDifference;
    const height = isSelected
      ? Math.max(0, Math.min(requestedHeight, window.innerHeight - maximizedTop))
      : requestedHeight;
    const width = isSelected
      ? Math.max(0, Math.min(requestedWidth, window.innerWidth - maximizedLeft))
      : requestedWidth;

    return {
      left: maximizedLeft,
      top: maximizedTop,
      height,
      width,
      borderColor: isSelected ? color : rgbaForHexColor(color, 0.4),
      ...(isSelected
        ? {
            backgroundColor: rgbaForHexColor(color, 0.16),
            boxShadow: outlineShadow(color),
          }
        : {}),
    };
  }, [nodeBounds, isSelected, color]);

  return <div className={classes} style={style} />;
};

export default Selection;
