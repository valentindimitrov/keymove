import React from 'react';

const SELECTION_MARGIN = 7;

type SelectionProps = { node: HTMLElement; isSelected: boolean };

const Selection = (props: SelectionProps) => {
  const { node, isSelected } = props;

  const classes = React.useMemo(() => {
    return ['yipyip-selection'].concat(isSelected ? ['yipyip-selected-selection'] : []).join(' ');
  }, [isSelected]);

  const nodeBounds = React.useMemo(() => node.getBoundingClientRect(), [node]);

  const style = React.useMemo(() => {
    const left = nodeBounds.left - SELECTION_MARGIN;
    const top = nodeBounds.top - SELECTION_MARGIN;
    // Don't allow the selection box to go off top or left of screen
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
      height: height,
      width: width,
    };
  }, [nodeBounds, isSelected]);

  return <div className={classes} style={style}></div>;
};

export default Selection;
