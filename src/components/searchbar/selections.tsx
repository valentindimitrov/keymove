import Selection from './selection.js';
import React from 'react';
import { frameTarget, paintFrameTargets } from '../../lib/frame_target.js';

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
  return (
    <>
      {visibleNodes
        .filter(node => !frameTarget(node))
        .map((node, index) => (
          <Selection
            key={`${refresh}${index}`}
            node={node}
            isSelected={node === selectedNode}
            color={color}
          />
        ))}
    </>
  );
};

export default Selections;
