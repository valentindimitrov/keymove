import Selection from './selection.js';

type SelectionsProps = {
  selectedSelectionIndex: number;
  matchingLinksAndButtons: HTMLElement[];
  refresh: boolean;
};

const Selections = (props: SelectionsProps) => {
  const { selectedSelectionIndex, matchingLinksAndButtons, refresh } = props;
  return (
    <>
      {matchingLinksAndButtons.map((node, index) => {
        const isSelected = index === selectedSelectionIndex;
        return <Selection key={`${refresh}${index}`} node={node} isSelected={isSelected} />;
      })}
    </>
  );
};

export default Selections;
