import { SEARCH_MODES } from '../../hooks/use_search_navigation.js';
import type { SearchMode } from '../../hooks/use_search_navigation.js';

type MatchesSummaryProps = {
  mode: SearchMode;
  hasSearchQuery: boolean;
  selectedSelectionIndex: number | null;
  resultCount: number;
};

const MatchesSummary = (props: MatchesSummaryProps) => {
  const { mode, hasSearchQuery, selectedSelectionIndex, resultCount } = props;
  const modeLabel = mode === SEARCH_MODES.TEXT ? 'Text' : 'Actions';
  // The mode is only switchable through a shortcut, so the label has to stay visible
  // even with no matches. Otherwise the searchbar gives no sign of which mode is active.
  return (
    <div id={'keymove-matches-summary'} role="status" aria-live="polite" aria-atomic="true">
      {hasSearchQuery && `${modeLabel} ${(selectedSelectionIndex ?? -1) + 1} / ${resultCount}`}
    </div>
  );
};

export default MatchesSummary;
