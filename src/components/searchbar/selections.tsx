import Selection from './selection.js';

type SelectionsProps = {
  selectedSelectionIndex: number | null;
  matchingNodes: Element[];
  refresh: boolean;
};

const Selections = (props: SelectionsProps) => {
  const { selectedSelectionIndex, matchingNodes, refresh } = props;
  return (
    <>
      {matchingNodes.map((node, index) => {
        const isSelected = index === selectedSelectionIndex;
        return <Selection key={`${refresh}${index}`} node={node} isSelected={isSelected} />;
      })}
    </>
  );
};

export default Selections;
