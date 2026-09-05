import { SEARCH_MODES } from '../../hooks/use_search_navigation.js';
import type { SearchMode } from '../../hooks/use_search_navigation.js';

type MatchesSummaryProps = {
  mode: SearchMode;
  selectedSelectionIndex: number | null;
  resultCount: number;
};

const MatchesSummary = (props: MatchesSummaryProps) => {
  const { mode, selectedSelectionIndex, resultCount } = props;
  const modeLabel = mode === SEARCH_MODES.TEXT ? 'Text' : 'Actions';
  return (
    <div id={'keymove-matches-summary'} role="status" aria-live="polite" aria-atomic="true">
      {resultCount > 0 && `${modeLabel} ${(selectedSelectionIndex ?? -1) + 1} / ${resultCount}`}
    </div>
  );
};

export default MatchesSummary;
