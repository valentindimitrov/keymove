import Selection from './selection.js';

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
  const visibleNodes = showOtherMatches ? matchingNodes : selectedNode ? [selectedNode] : [];
  return (
    <>
      {visibleNodes.map((node, index) => (
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
