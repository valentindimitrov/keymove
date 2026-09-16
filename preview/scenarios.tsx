import React from 'react';
import InfoDropdown from '../src/components/searchbar/info_dropdown.js';
import DraggableContainer from '../src/components/searchbar/draggable_container.js';
import PopupLayoutActions from '../src/components/popup/popup_layout_actions.js';
import popupStyles from '../src/popup.css?inline';
import MatchesSummary from '../src/components/searchbar/matches_summary.js';
import ResultsPanel from '../src/components/searchbar/results_panel.js';
import SearchInput from '../src/components/searchbar/search_input.js';
import { SEARCH_MODES } from '../src/hooks/use_search_navigation.js';
import { KEYMOVE_CONTAINER_WIDTH } from '../src/constants.js';
import SettingsButton from '../src/components/searchbar/settings_button.js';
import SuggestionCountSetting from '../src/components/popup/suggestion_count_setting.js';
import InfoPanelButtons from '../src/components/searchbar/info_panel/info_panel_buttons.js';
import InfoPanelSettingRow from '../src/components/searchbar/info_panel/info_panel_setting_row.js';
import useSuggestions, { type Suggestion } from '../src/hooks/use_suggestions.js';
import type { SearchMode } from '../src/hooks/use_search_navigation.js';

type BarProps = {
  searchText: string;
  mode?: SearchMode;
  isFuzzy?: boolean;
  selectedSelectionIndex?: number | null;
  resultCount?: number;
  suggestions?: Suggestion[];
  selectedNode?: Element | null;
  above?: boolean;
  width?: number;
  y?: number;
  locked?: boolean;
  pending?: boolean;
  onSearchTextChange?: (query: string) => void;
  suggestionsOpen?: boolean;
  onOpenSettings?: () => void;
};

function suggestionNode(label: string) {
  const node = document.createElement('a');
  node.textContent = label;
  return node;
}

// Built once so a scenario can mark one of them selected by identity, the way the searchbar
// does with the node the cursor is on.
const NODES = {
  guidelines: suggestionNode('Contributing guidelines'),
  howTo: suggestionNode('How to contribute'),
  welcome: suggestionNode('…we welcome contributions from…'),
};

const APPROXIMATE_SLATE: Suggestion[] = [
  {
    kind: 'action',
    node: NODES.guidelines,
    term: 'Contribu',
    label: 'Contributing guidelines',
    context: 'link · 1 edit away · in Navigation',
  },
  {
    kind: 'action',
    node: NODES.howTo,
    term: 'contribu',
    label: 'How to contribute',
    context: 'button · 1 edit away · in Sidebar',
  },
  {
    kind: 'text',
    node: NODES.welcome,
    term: 'contribu',
    label: '…we welcome contributions from…',
    context: 'paragraph · 1 edit away',
  },
];

const EXACT_SLATE: Suggestion[] = APPROXIMATE_SLATE.map(entry => ({
  ...entry,
  context: entry.context.replace(' · 1 edit away', ''),
}));

const LONG_SLATE: Suggestion[] = [
  {
    kind: 'text',
    node: suggestionNode('long'),
    term: 'keyboard',
    label: 'Use an accessible, keyboard-operable settings panel with announced match counts',
    context: 'list item · in Main content',
  },
  ...EXACT_SLATE.slice(0, 2),
];

const ALIGNED_SLATE: Suggestion[] = [
  {
    kind: 'action',
    node: suggestionNode('font-link'),
    term: 'test',
    label: 'FontVS: Free Font Viewer & Tester | Compare Fonts Online',
    context: 'link · in Main content',
  },
  {
    kind: 'text',
    node: suggestionNode('font-heading'),
    term: 'test',
    label: 'FontVS: Free Font Viewer & Tester | Compare Fonts Online',
    context: 'heading · in Main content',
  },
  {
    kind: 'text',
    node: suggestionNode('font-paragraph'),
    term: 'test',
    label: 'FontVS: Free online font tester. Instantly preview & compare different installed…',
    context: 'paragraph · in Main content',
  },
];

const Bar = (props: BarProps) => {
  const {
    searchText,
    mode = SEARCH_MODES.ACTIONS,
    isFuzzy = false,
    selectedSelectionIndex = 0,
    resultCount = 4,
    suggestions = [],
    selectedNode = null,
    above = false,
    width = KEYMOVE_CONTAINER_WIDTH,
    y = 0.5,
    locked = false,
    pending = false,
    onSearchTextChange = () => undefined,
    suggestionsOpen,
    onOpenSettings = () => undefined,
  } = props;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [currentWidth, setCurrentWidth] = React.useState(width);
  const [currentMode, setCurrentMode] = React.useState(mode);
  const [currentPosition, setCurrentPosition] = React.useState({ x: 0.5, y });

  return (
    <DraggableContainer
      locked={locked}
      className={above ? 'keymove-container-suggestions-above' : undefined}
      width={currentWidth}
      updateWidth={setCurrentWidth}
      position={currentPosition}
      updatePosition={setCurrentPosition}
      containerRef={containerRef}
      searchInputRef={searchInputRef}
    >
      <div id={'keymove-bar'}>
        <SettingsButton onClick={onOpenSettings} />
        <SearchInput
          inputRef={searchInputRef}
          searchText={searchText}
          suggestionCount={suggestions.length}
          suggestionsOpen={suggestionsOpen ?? suggestions.length > 0}
          activeSuggestionIndex={null}
          onBlur={() => undefined}
          updateSearchText={onSearchTextChange}
        />
        <MatchesSummary
          mode={currentMode}
          onToggleMode={() =>
            setCurrentMode(
              currentMode === SEARCH_MODES.TEXT ? SEARCH_MODES.ACTIONS : SEARCH_MODES.TEXT,
            )
          }
          hasSearchQuery={searchText.length > 0}
          isFuzzy={isFuzzy}
          selectedSelectionIndex={selectedSelectionIndex}
          resultCount={resultCount}
        />
      </div>
      <ResultsPanel
        open={suggestionsOpen ?? suggestions.length > 0}
        pending={pending}
        suggestions={suggestions}
        selectedNode={selectedNode}
        above={above}
        onSelect={() => undefined}
      />
    </DraggableContainer>
  );
};

type Scenario = { name: string; description: string; render: () => React.ReactNode };

const LayoutLockPreview = () => {
  const [locked, setLocked] = React.useState(false);
  const [reset, setReset] = React.useState(0);
  return (
    <>
      <style>{popupStyles}</style>
      <div id="keymove-popup" style={{ position: 'fixed', top: 20, left: 20, width: 420 }}>
        <PopupLayoutActions
          locked={locked}
          onToggleLock={() => setLocked(!locked)}
          onReset={() => setReset(reset + 1)}
        />
      </div>
      <Bar key={reset} searchText="test" suggestions={ALIGNED_SLATE} locked={locked} y={0.4} />
    </>
  );
};

const SuggestionsRefreshPreview = () => {
  const [query, setQuery] = React.useState('contribu');
  const [committedQuery, setCommittedQuery] = React.useState(query);
  const pending = query !== committedQuery;
  const matches = React.useMemo(
    () =>
      EXACT_SLATE.filter(row => row.label.toLowerCase().includes(committedQuery.toLowerCase())).map(
        (row, index) => ({ ...row, score: 10 - index, term: committedQuery, distance: null }),
      ),
    [committedQuery],
  );
  const suggestions = useSuggestions({
    suggestions: matches,
    searchText: query,
    isFuzzy: false,
    pending,
  });
  return (
    <>
      <button
        style={{ position: 'fixed', top: 20, left: 20 }}
        onClick={() => setCommittedQuery(query)}
      >
        Complete pending search
      </button>
      <Bar
        searchText={query}
        onSearchTextChange={setQuery}
        suggestionsOpen={query.trim().length >= 3}
        suggestions={suggestions}
        pending={pending}
        selectedNode={pending ? null : (suggestions[0]?.node ?? null)}
        above
        y={0.75}
      />
    </>
  );
};

const SearchControlsPreview = () => {
  const [count, setCount] = React.useState(3);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const rows = [...EXACT_SLATE, ...ALIGNED_SLATE].slice(0, count);
  return (
    <>
      <style>{popupStyles}</style>
      {settingsOpen && (
        <div
          id="keymove-popup"
          style={{ position: 'fixed', top: 20, left: 20, width: 420, background: '#1c1c1c' }}
        >
          <SuggestionCountSetting value={count} onChange={setCount} />
        </div>
      )}
      <Bar
        searchText="contribu"
        mode={SEARCH_MODES.TEXT}
        suggestions={rows}
        selectedNode={NODES.guidelines}
        onOpenSettings={() => setSettingsOpen(!settingsOpen)}
      />
    </>
  );
};

const SCENARIOS: Scenario[] = [
  {
    name: 'help-viewport-fit',
    description: 'Open keyboard help, then shrink the viewport to check wrapping and scrolling',
    render: () => (
      <div style={{ position: 'fixed', bottom: 20, right: 20 }}>
        <InfoDropdown />
      </div>
    ),
  },
  {
    name: 'suggestion-setting-alignment',
    description: 'Suggestion count uses the same control and text columns as the settings above',
    render: () => (
      <>
        <style>{popupStyles}</style>
        <div
          id="keymove-popup"
          style={{
            position: 'fixed',
            top: 20,
            left: 20,
            width: 420,
            padding: 18,
            background: '#1c1c1c',
          }}
        >
          <InfoPanelSettingRow
            label="Autohide"
            description="Hide the KeyMove searchbar when not searching."
            value={true}
            onChange={() => {}}
          />
          <SuggestionCountSetting value={3} onChange={() => {}} />
        </div>
      </>
    ),
  },
  {
    name: 'support-link',
    description: 'Development-only Stripe support link alongside source and contact actions',
    render: () => (
      <>
        <style>{popupStyles}</style>
        <div
          id="keymove-popup"
          style={{
            position: 'fixed',
            top: 20,
            left: 20,
            width: 420,
            padding: 18,
            background: '#1c1c1c',
          }}
        >
          <div className="keymove-popup-links">
            <InfoPanelButtons />
          </div>
        </div>
      </>
    ),
  },
  {
    name: 'search-controls',
    description:
      'Colour logo opens settings, clickable mode label, configurable row count and selected gray row',
    render: () => <SearchControlsPreview />,
  },
  {
    name: 'suggestions-refresh',
    description:
      'Type to hold a pending query; complete it to check stable panel geometry and row updates',
    render: () => <SuggestionsRefreshPreview />,
  },
  {
    name: 'layout-lock',
    description:
      'Real popup buttons: lock/unlock dragging and resizing, with boxed Action/Text badges',
    render: () => <LayoutLockPreview />,
  },
  {
    name: 'bar-only',
    description: 'The bar with no query, which is how it rests on every page',
    render: () => <Bar searchText="" mode={SEARCH_MODES.TEXT} resultCount={0} />,
  },
  {
    name: 'bar-typing',
    description: 'A query with matches but no slate yet, under three characters',
    render: () => (
      <Bar searchText="co" mode={SEARCH_MODES.TEXT} selectedSelectionIndex={0} resultCount={61} />
    ),
  },
  {
    name: 'slate-below',
    description: 'Three exact results, opening downwards',
    render: () => (
      <Bar
        searchText="contribu"
        suggestions={EXACT_SLATE}
        selectedNode={NODES.guidelines}
        y={0.25}
      />
    ),
  },
  {
    name: 'slate-above',
    description: 'The same slate opening upwards, with the bar left where it was put',
    render: () => (
      <Bar
        searchText="contribu"
        suggestions={EXACT_SLATE}
        selectedNode={NODES.guidelines}
        above
        y={0.8}
      />
    ),
  },
  {
    name: 'slate-approximate',
    description: 'Approximate results, marked in the count and on every row',
    render: () => (
      <Bar
        searchText="contribuu"
        isFuzzy
        suggestions={APPROXIMATE_SLATE}
        selectedNode={NODES.guidelines}
        y={0.25}
      />
    ),
  },
  {
    name: 'slate-long-labels',
    description: 'A long text label, where a row has to wrap',
    render: () => (
      <Bar searchText="keyboard" mode={SEARCH_MODES.TEXT} suggestions={LONG_SLATE} y={0.25} />
    ),
  },
  {
    name: 'slate-alignment',
    description: 'Matching Action/Text badge columns and centered numbers on wrapped rows',
    render: () => (
      <Bar
        searchText="test"
        mode={SEARCH_MODES.TEXT}
        resultCount={2}
        suggestions={ALIGNED_SLATE}
        y={0.25}
      />
    ),
  },
  {
    name: 'narrow',
    description: 'Resized to the narrowest allowed width',
    render: () => <Bar searchText="contribu" suggestions={EXACT_SLATE} width={260} y={0.25} />,
  },
  {
    name: 'viewport-fit',
    description:
      'Saved 650px width: shrink the viewport to check controls, then widen to restore it',
    render: () => <Bar searchText="contribu" suggestions={EXACT_SLATE} width={650} y={0.25} />,
  },
  {
    name: 'wide',
    description: 'Resized wide, where rows stop wrapping',
    render: () => <Bar searchText="contribu" suggestions={EXACT_SLATE} width={760} y={0.25} />,
  },
  {
    name: 'text-mode',
    description: 'Text mode, so the count and the mode label read differently',
    render: () => (
      <Bar
        searchText="contribu"
        mode={SEARCH_MODES.TEXT}
        resultCount={12}
        selectedSelectionIndex={2}
        suggestions={EXACT_SLATE}
        y={0.25}
      />
    ),
  },
];

export type { Scenario };
export { SCENARIOS };
