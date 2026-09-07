import React from 'react';
import DraggableContainer from '../src/components/searchbar/draggable_container.js';
import MatchesSummary from '../src/components/searchbar/matches_summary.js';
import ResultsPanel from '../src/components/searchbar/results_panel.js';
import SearchInput from '../src/components/searchbar/search_input.js';
import { SEARCH_MODES } from '../src/hooks/use_search_navigation.js';
import { KEYMOVE_CONTAINER_WIDTH } from '../src/constants.js';
import Logo from '../src/icons/logo-without-color.svg?react';
import type { Suggestion } from '../src/hooks/use_suggestions.js';
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
  } = props;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [currentWidth, setCurrentWidth] = React.useState(width);

  return (
    <DraggableContainer
      className={above ? 'keymove-container-suggestions-above' : undefined}
      width={currentWidth}
      updateWidth={setCurrentWidth}
      position={{ x: 0.5, y }}
      updatePosition={() => undefined}
      containerRef={containerRef}
      searchInputRef={searchInputRef}
    >
      <div id={'keymove-bar'}>
        <Logo />
        <SearchInput
          inputRef={searchInputRef}
          searchText={searchText}
          suggestionCount={suggestions.length}
          activeSuggestionIndex={null}
          onBlur={() => undefined}
          updateSearchText={() => undefined}
        />
        <MatchesSummary
          mode={mode}
          hasSearchQuery={searchText.length > 0}
          isFuzzy={isFuzzy}
          selectedSelectionIndex={selectedSelectionIndex}
          resultCount={resultCount}
        />
      </div>
      <ResultsPanel suggestions={suggestions} selectedNode={selectedNode} above={above} />
    </DraggableContainer>
  );
};

type Scenario = { name: string; description: string; render: () => React.ReactNode };

const SCENARIOS: Scenario[] = [
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
    name: 'narrow',
    description: 'Resized to the narrowest allowed width',
    render: () => <Bar searchText="contribu" suggestions={EXACT_SLATE} width={260} y={0.25} />,
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
