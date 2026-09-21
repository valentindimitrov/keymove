import React from 'react';
import InfoDropdown from '../src/components/searchbar/info_dropdown.js';
import DraggableContainer from '../src/components/searchbar/draggable_container.js';
import PopupLayoutActions from '../src/components/popup/popup_layout_actions.js';
import popupStyles from '../src/popup.css?inline';
import themePreviewStyles from './theme.css?inline';
import MatchesSummary from '../src/components/searchbar/matches_summary.js';
import ResultsPanel from '../src/components/searchbar/results_panel.js';
import ActionMenu from '../src/components/searchbar/action_menu.js';
import { ACTION_MENU_RESULT_HEIGHT } from '../src/constants.js';
import { actionsForResult } from '../src/lib/result_actions.js';
import SearchInput from '../src/components/searchbar/search_input.js';
import { SEARCH_MODES } from '../src/hooks/use_search_navigation.js';
import { KEYMOVE_CONTAINER_WIDTH } from '../src/constants.js';
import SettingsButton from '../src/components/searchbar/settings_button.js';
import SuggestionCountSetting from '../src/components/popup/suggestion_count_setting.js';
import InfoPanelButtons from '../src/components/searchbar/info_panel/info_panel_buttons.js';
import InfoPanelSettingRow from '../src/components/searchbar/info_panel/info_panel_setting_row.js';
import useSuggestions, { type Suggestion } from '../src/hooks/use_suggestions.js';
import type { SearchMode } from '../src/hooks/use_search_navigation.js';
import { keepExtensionRootConnected } from '../src/lib/create_extension_root.js';
import Selection from '../src/components/searchbar/selection.js';
import { createModalFixture } from './modal_fixture.js';
import { kindLabelForNode } from '../src/lib/suggestion_context.js';
import ThemeSetting from '../src/components/popup/theme_setting.js';
import InfoPanelSettings from '../src/components/searchbar/info_panel/info_panel_settings.js';
import InfoPanelSectionHeader from '../src/components/searchbar/info_panel/info_panel_section_header.js';
import PopupPositionGrid from '../src/components/popup/popup_position_grid.js';
import { usePortalTarget } from '../src/components/searchbar/portal.js';
import useTheme from '../src/hooks/use_theme.js';
import { validateStoredSetting } from '../src/lib/stored_settings_schema.js';

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
  showActionMenu?: boolean;
  tooltipsMode?: boolean;
};

function ThemeSettingsPreview() {
  const [theme, setTheme] = React.useState(
    () =>
      validateStoredSetting('theme', new URLSearchParams(location.search).get('theme') ?? 'system')
        .value,
  );
  const [count, setCount] = React.useState(3);
  const [autoHide, setAutoHide] = React.useState(true);
  const [tooltipsMode, setTooltipsMode] = React.useState(true);
  const [locked, setLocked] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0.5, y: 0.75 });
  const root = usePortalTarget()?.getRootNode();
  useTheme(theme, root instanceof ShadowRoot ? root.host : null);
  return (
    <>
      <style>{popupStyles}</style>
      <style>{themePreviewStyles}</style>
      <div id="keymove-popup" className="keymove-theme-preview">
        <InfoPanelSectionHeader text="Settings" />
        <ThemeSetting value={theme} onChange={setTheme} />
        <InfoPanelSettings
          tooltipsMode={tooltipsMode}
          toggleTooltipsMode={() => setTooltipsMode(!tooltipsMode)}
          autoHide={autoHide}
          toggleAutoHide={() => setAutoHide(!autoHide)}
          alwaysOn={true}
          toggleAlwaysOn={() => {}}
          startInActionMode={false}
          toggleStartInActionMode={() => {}}
          highlightMatches={true}
          toggleHighlightMatches={() => {}}
          showAutohideButton={false}
          toggleShowAutohideButton={() => {}}
          highlightColors={{ text: '#f59e0b', actions: '#a78bfa' }}
          updateHighlightColor={() => {}}
          resetHighlightColors={() => {}}
        />
        <SuggestionCountSetting value={count} onChange={setCount} />
        <InfoPanelSectionHeader text="Searchbar position and size" marginTop />
        <PopupPositionGrid position={position} updatePosition={setPosition} disabled={locked} />
        <PopupLayoutActions
          locked={locked}
          onToggleLock={() => setLocked(!locked)}
          onReset={() => setPosition({ x: 0.5, y: 0.75 })}
        />
        <div className="keymove-popup-links">
          <InfoPanelButtons />
        </div>
      </div>
    </>
  );
}

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
      bottomContentHeight={props.showActionMenu ? ACTION_MENU_RESULT_HEIGHT : 0}
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
          tooltipsMode={props.tooltipsMode ?? true}
          inputRef={searchInputRef}
          searchText={searchText}
          suggestionCount={suggestions.length}
          suggestionsOpen={suggestionsOpen ?? suggestions.length > 0}
          activeSuggestionIndex={null}
          actionMenuOpen={props.showActionMenu ?? false}
          actionsAvailable={props.showActionMenu ?? false}
          onBlur={() => undefined}
          updateSearchText={onSearchTextChange}
        />
        <MatchesSummary
          tooltipsMode={props.tooltipsMode ?? true}
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
      {props.showActionMenu ? (
        <ActionMenu
          tooltipsMode={props.tooltipsMode ?? true}
          actions={actionsForResult(
            Object.assign(document.createElement('a'), {
              href: 'https://example.org/report',
              textContent: 'Download report',
            }),
            null,
          )}
          suggestion={{
            kind: 'action',
            node: document.createElement('a'),
            term: 'report',
            label:
              'Download report comparing Stream Deck + and Stream Deck + XL with detailed specifications',
            context: 'link · in Main content',
          }}
          above={above}
          maxHeight={350}
          searchInputRef={searchInputRef}
          onClose={() => undefined}
          onNavigate={() => undefined}
          onAction={() => undefined}
        />
      ) : (
        <ResultsPanel
          tooltipsMode={props.tooltipsMode ?? true}
          open={suggestionsOpen ?? suggestions.length > 0}
          pending={pending}
          suggestions={suggestions}
          selectedNode={selectedNode}
          above={above}
          onSelect={() => undefined}
        />
      )}
    </DraggableContainer>
  );
};

type Scenario = { name: string; description: string; render: () => React.ReactNode };

const TransformedModalPreview = () => {
  const [target, setTarget] = React.useState<Element | null>(null);
  React.useEffect(() => {
    const drawer = createModalFixture();
    const host = document.getElementById('keymove-root')!;
    const connection = keepExtensionRootConnected(host);
    setTarget(drawer.querySelector('#price-low'));
    return () => {
      connection.disconnect();
      if (host.matches(':popover-open')) host.hidePopover();
      host.removeAttribute('popover');
      document.body.append(host);
      drawer.remove();
    };
  }, []);
  return (
    target && (
      <>
        <Selection node={target} isSelected color="#e69500" />
        <Bar
          searchText="prix"
          mode={SEARCH_MODES.TEXT}
          resultCount={2}
          selectedNode={target}
          suggestions={[
            {
              kind: 'text',
              node: target,
              term: 'Prix',
              label: target.textContent ?? '',
              context: 'list item · in Dialog',
            },
          ]}
        />
      </>
    )
  );
};

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
    name: 'theme-settings',
    description: 'Shared settings grid and live System, Light, and Dark appearance controls.',
    render: () => <ThemeSettingsPreview />,
  },
  ...[false, true].map(narrow => ({
    name: narrow ? 'control-states-narrow' : 'control-states',
    description: 'Live control state descriptions at normal and minimum width',
    render: () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.indeterminate = true;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.checked = true;
      const button = document.createElement('button');
      button.setAttribute('aria-expanded', 'false');
      button.disabled = true;
      const nodes = [checkbox, radio, button];
      const labels = ['Account notifications', 'Account delivery preference', 'Account options'];
      return (
        <Bar
          searchText="account"
          mode={SEARCH_MODES.ACTIONS}
          resultCount={3}
          width={narrow ? 260 : KEYMOVE_CONTAINER_WIDTH}
          suggestions={nodes.map((node, i) => ({
            kind: 'action',
            node,
            term: 'account',
            label: labels[i]!,
            context: `${kindLabelForNode(node, 'action')} · in Form`,
          }))}
        />
      );
    },
  })),
  {
    name: 'action-menu',
    description: 'Link actions with native keyboard focus and an above-bar menu.',
    render: () => <Bar searchText="report" showActionMenu above y={0.85} />,
  },
  {
    name: 'action-menu-narrow',
    description: 'Action labels and keyboard hint at the minimum searchbar width.',
    render: () => <Bar searchText="report" showActionMenu width={260} y={0.15} />,
  },
  {
    name: 'action-menu-clean',
    description: 'Compact action numbers without usage reminders when Tooltips mode is off.',
    render: () => (
      <Bar searchText="report" showActionMenu tooltipsMode={false} width={260} y={0.15} />
    ),
  },
  {
    name: 'action-menu-bottom-edge',
    description:
      'The retained one-line suggestion stays visible beneath the bar at the bottom edge.',
    render: () => <Bar searchText="report" showActionMenu above width={260} y={1} />,
  },
  ...[true, false].map(tooltipsMode => ({
    name: `suggestions-${tooltipsMode ? 'hints' : 'clean'}`,
    description: 'Narrow suggestions with optional full keyboard shortcut badges.',
    render: () => (
      <Bar
        searchText="report"
        tooltipsMode={tooltipsMode}
        width={260}
        suggestions={[
          {
            kind: 'action',
            node: suggestionNode('Download report'),
            term: 'report',
            label: 'Download report',
            context: 'link · in Main content',
          },
        ]}
      />
    ),
  })),
  {
    name: 'transformed-modal',
    description: 'Viewport-aligned UI inside a transformed, scrollable side drawer',
    render: () => <TransformedModalPreview />,
  },
  {
    name: 'control-names',
    description: 'Control names and unavailable state in the action shortlist',
    render: () => (
      <Bar
        searchText="account"
        mode={SEARCH_MODES.ACTIONS}
        resultCount={3}
        y={0.25}
        suggestions={[
          {
            kind: 'action',
            node: suggestionNode('Account email'),
            term: null,
            label: 'Account email',
            context: 'text field · in Form',
          },
          {
            kind: 'action',
            node: suggestionNode('Account notifications'),
            term: null,
            label: 'Account notifications',
            context: 'switch · in Form',
          },
          {
            kind: 'action',
            node: suggestionNode('Account settings'),
            term: null,
            label: 'Account settings',
            context: 'button · unavailable · in Form',
          },
        ]}
      />
    ),
  },
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
