import { SEARCH_MODES } from '../../hooks/use_search_navigation.js';
import type { SearchMode } from '../../hooks/use_search_navigation.js';

type MatchesSummaryProps = {
  mode: SearchMode;
  hasSearchQuery: boolean;
  isFuzzy?: boolean;
  selectedSelectionIndex: number | null;
  resultCount: number;
  onToggleMode?: () => void;
};

const MatchesSummary = (props: MatchesSummaryProps) => {
  const { mode, hasSearchQuery, isFuzzy = false, selectedSelectionIndex, resultCount } = props;
  // Approximate results are marked, because an unmarked count would claim the page contains
  // something it does not.
  const modeLabel = mode === SEARCH_MODES.TEXT ? 'Text' : 'Actions';
  // The mode is only switchable through a shortcut, so the label has to stay visible
  // even with no matches. Otherwise the searchbar gives no sign of which mode is active.
  return (
    <div id={'keymove-matches-summary'} role="status" aria-live="polite" aria-atomic="true">
      {hasSearchQuery && (
        <>
          <button
            type="button"
            className="keymove-mode-button"
            aria-label={`Switch to ${mode === SEARCH_MODES.TEXT ? 'actions' : 'text'}`}
            title="Switch search mode (Alt+S)"
            onMouseDown={event => event.preventDefault()}
            onClick={props.onToggleMode}
          >
            {modeLabel}
          </button>
          {`${isFuzzy ? ' ~' : ''} ${(selectedSelectionIndex ?? -1) + 1} / ${resultCount}`}
        </>
      )}
    </div>
  );
};

export default MatchesSummary;
