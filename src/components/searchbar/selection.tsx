import React from 'react';

const SELECTION_MARGIN = 7;

type SelectionProps = { node: Element; isSelected: boolean };

const Selection = (props: SelectionProps) => {
  const { node, isSelected } = props;

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
    };
  }, [nodeBounds, isSelected]);

  return <div className={classes} style={style} />;
};

export default Selection;
