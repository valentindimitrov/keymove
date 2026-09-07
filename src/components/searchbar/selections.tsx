import Selection from './selection.js';

type SelectionsProps = {
  selectedSelectionIndex: number | null;
  matchingNodes: Element[];
  refresh: boolean;
  color: string;
};

const Selections = (props: SelectionsProps) => {
  const { selectedSelectionIndex, matchingNodes, refresh, color } = props;
  return (
    <>
      {matchingNodes.map((node, index) => {
        const isSelected = index === selectedSelectionIndex;
        return (
          <Selection key={`${refresh}${index}`} node={node} isSelected={isSelected} color={color} />
        );
      })}
    </>
  );
};

export default Selections;
