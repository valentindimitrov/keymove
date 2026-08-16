type MatchesSummaryProps = {
  selectedSelectionIndex: number;
  matchingLinksAndButtons: HTMLElement[];
};

const MatchesSummary = (props: MatchesSummaryProps) => {
  const { selectedSelectionIndex, matchingLinksAndButtons } = props;
  return (
    <div id={'yipyip-matches-summary'}>
      {matchingLinksAndButtons.length > 0 &&
        `${selectedSelectionIndex + 1} / ${matchingLinksAndButtons.length}`}
    </div>
  );
};

export default MatchesSummary;
