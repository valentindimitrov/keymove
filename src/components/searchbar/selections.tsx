import Selection from './selection.js';
import React from 'react';
import { frameTarget, paintFrameTargets } from '../../lib/frame_target.js';

function nearViewport(bounds: DOMRect) {
  const height = window.innerHeight;
  const width = window.innerWidth;
  return (
    bounds.bottom >= -height &&
    bounds.top <= 2 * height &&
    bounds.right >= -width &&
    bounds.left <= 2 * width
  );
}

type SelectionsProps = {
  selectedSelectionIndex: number | null;
  matchingNodes: Element[];
  refresh: boolean;
  color: string;
  showOtherMatches?: boolean;
};

const Selections = (props: SelectionsProps) => {
  const { selectedSelectionIndex, matchingNodes, refresh, color, showOtherMatches = false } = props;
  const selectedNode =
    selectedSelectionIndex === null ? null : matchingNodes[selectedSelectionIndex];
  const visibleNodes = React.useMemo(
    () => (showOtherMatches ? matchingNodes : selectedNode ? [selectedNode] : []),
    [showOtherMatches, matchingNodes, selectedNode],
  );
  React.useEffect(
    () => paintFrameTargets(visibleNodes, selectedNode ?? null, color, showOtherMatches),
    [visibleNodes, selectedNode, showOtherMatches, color, refresh],
  );
  // Outlines for matches far off screen cost a box read and an element each, and a short
  // query on a long page has thousands. Scrolling refreshes them, so only matches within
  // a screen of the viewport, and the selected one, are drawn.
  const outlines = visibleNodes
    .filter(node => !frameTarget(node))
    .map(node => ({ node, bounds: node.getBoundingClientRect() }))
    .filter(({ node, bounds }) => node === selectedNode || nearViewport(bounds));
  return (
    <>
      {outlines.map(({ node, bounds }, index) => (
        <Selection
          key={`${refresh}${index}`}
          bounds={bounds}
          isSelected={node === selectedNode}
          color={color}
        />
      ))}
    </>
  );
};

export default Selections;
