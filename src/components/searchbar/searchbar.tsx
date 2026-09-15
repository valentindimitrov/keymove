import React from 'react';
import { browser } from 'wxt/browser';
import useWindowEvent from '../../hooks/use_window_event.js';
import useDocumentEvent from '../../hooks/use_document_event.js';
import useHighlights from '../../hooks/use_highlights.js';
import useKeyboardShortcuts from '../../hooks/use_keyboard_shortcuts.js';
import useStoredSettings from '../../hooks/use_stored_settings.js';
import useExtensionMessaging from '../../hooks/use_extension_messaging.js';
import useSearchNavigation, {
  effectiveSearchMode,
  SEARCH_MODES,
} from '../../hooks/use_search_navigation.js';
import type { SearchMode } from '../../hooks/use_search_navigation.js';
import usePopupPosition from '../../hooks/use_popup_position.js';
import useWindowSize from '../../hooks/use_window_size.js';
import usePopupWidth from '../../hooks/use_popup_width.js';
import useSuggestions from '../../hooks/use_suggestions.js';
import useHighlightColors from '../../hooks/use_highlight_colors.js';

import Utils from '../../lib/utils.js';
import FindInPage, { subscribeToPageChanges } from '../../lib/find_in_page.js';
import type { RankedMatch } from '../../lib/page_search_index.js';
import { isTextVisible, visibleText } from '../../lib/visible_text.js';
import SearchInput from './search_input.js';
import Selections from './selections.js';
import MatchesSummary from './matches_summary.js';
import ResultsPanel from './results_panel.js';
import DraggableContainer from './draggable_container.js';
import InfoDropdown from './info_dropdown.js';
import VisibilityButton from './visibility_button.js';
import Logo from '../../icons/logo-without-color.svg?react';
import ExtensionMessageTypes from '../../extension_message_types.js';
import type { KeyboardShortcutName } from '../../lib/static_data_schema.js';
import { EXTENSION_NAME } from '../../extension_identity.js';
import {
  KEYMOVE_CONTAINER_HEIGHT,
  SUGGESTION_PANEL_PADDING,
  SUGGESTION_ROW_HEIGHT,
} from '../../constants.js';

const SCROLL_OR_RESIZE_UPDATE_TIMEOUT_DURATION = 100;
type ShortcutHandler = (event: KeyboardEvent) => void;
type ActionActivation = 'current' | 'foreground-tab' | 'background-tab';

const Searchbar = () => {
  const scrollOrResizeUpdateTimeout = React.useRef<number | undefined>(undefined);
  const searchAbortController = React.useRef<AbortController | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const focusRequested = React.useRef(false);

  const {
    autoHide,
    updateAutoHide,
    alwaysOn,
    startInActionMode,
    highlightMatches,
    showAutohideButton,
  } = useStoredSettings();
  const defaultSearchMode = startInActionMode ? SEARCH_MODES.ACTIONS : SEARCH_MODES.TEXT;
  // Seeded with the reducer's initial mode, not the first computed default, so a stored
  // default that is already loaded on the first render still gets adopted.
  const previousDefaultSearchMode = React.useRef<SearchMode>(SEARCH_MODES.TEXT);
  const previousAutoHide = React.useRef(autoHide);
  const {
    state: searchNavigation,
    setResults: setSearchResults,
    clearResults: clearSearchResults,
    reset: resetSearchNavigation,
    setMode,
    setSelectedIndex,
  } = useSearchNavigation();
  const { colors: highlightColors } = useHighlightColors();
  const { position: popupPosition, updatePosition: updatePopupPosition } = usePopupPosition();
  const { width: popupWidth, updateWidth: updatePopupWidth } = usePopupWidth();
  const windowSize = useWindowSize();

  const [isHidden, setIsHidden] = React.useState<boolean>(autoHide);
  const [searchText, setSearchText] = React.useState('');
  const [isFuzzy, setIsFuzzy] = React.useState(false);
  const [rankedMatches, setRankedMatches] = React.useState<RankedMatch[]>([]);
  const previousSearchText = React.useRef(searchText);
  const [scrollOrResizeRefresh, setScrollOrResizeRefresh] = React.useState<boolean>(false);
  const [hideSelections, setHideSelections] = React.useState<boolean>(false);
  const isInteractive = !isHidden;

  const matchingText = searchNavigation.results.text;
  const matchingLinksAndButtons = searchNavigation.results.actions;
  const matchingTextNodes = React.useMemo(
    () => matchingText.map(match => match.node),
    [matchingText],
  );
  // Everything the user navigates and sees follows the effective mode; only the Alt+S
  // toggle acts on the chosen one, so a fallback never silently rewrites their choice.
  const chosenMode = searchNavigation.mode;
  const navigationMode = effectiveSearchMode(searchNavigation);
  const selectedSelectionIndex = searchNavigation.selectedIndices[navigationMode];
  const selectedTextMatch =
    navigationMode === SEARCH_MODES.TEXT && selectedSelectionIndex !== null
      ? (matchingText[selectedSelectionIndex] ?? null)
      : null;
  const selectedActionNode =
    navigationMode === SEARCH_MODES.TEXT
      ? (selectedTextMatch?.action ?? null)
      : selectedSelectionIndex === null
        ? null
        : (matchingLinksAndButtons[selectedSelectionIndex] ?? null);
  const selectedActionLinkUrl = Utils.linkUrlForNode(selectedActionNode);
  const activeMatchingNodes =
    navigationMode === SEARCH_MODES.TEXT ? matchingTextNodes : matchingLinksAndButtons;

  const focusSearchInput = React.useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const revealAndFocus = React.useCallback(() => {
    setIsHidden(false);
    if (isInteractive) {
      focusSearchInput();
    } else {
      focusRequested.current = true;
    }
  }, [isInteractive, focusSearchInput]);

  React.useLayoutEffect(() => {
    if (isInteractive && focusRequested.current) {
      focusRequested.current = false;
      focusSearchInput();
    }
  }, [isInteractive, focusSearchInput]);

  const cancelPendingSearch = React.useCallback(() => {
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
  }, []);

  const resetSearchTextAndMatches = React.useCallback(() => {
    cancelPendingSearch();
    setSearchText('');
    resetSearchNavigation(defaultSearchMode);
    Utils.clearPageSelection();
  }, [cancelPendingSearch, resetSearchNavigation, defaultSearchMode]);

  const hide = React.useCallback(() => {
    setIsHidden(true);
    resetSearchTextAndMatches();
  }, [resetSearchTextAndMatches]);

  const handleBlur = React.useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (Utils.isExtensionElement(event.relatedTarget)) {
        return;
      }
      if (autoHide) {
        setIsHidden(true);
      }
      resetSearchTextAndMatches();
    },
    [autoHide, resetSearchTextAndMatches],
  );

  const activateSelectedMatchingNodeAndReset = React.useCallback(
    (event: KeyboardEvent, activation: ActionActivation = 'current') => {
      if (!selectedActionNode?.isConnected || !isTextVisible(selectedActionNode)) {
        return;
      }

      const linkUrl = Utils.openableLinkUrlForNode(selectedActionNode);
      if (activation !== 'current' && !linkUrl) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (activation === 'current') {
        Utils.clickOrFocusNode(selectedActionNode);
      } else {
        void browser.runtime
          .sendMessage({
            type: ExtensionMessageTypes.OPEN_LINK_IN_NEW_TAB,
            url: linkUrl,
            active: activation === 'foreground-tab',
          })
          .catch(error => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`${EXTENSION_NAME} could not request a new link tab: ${message}`);
          });
      }

      if (autoHide) {
        setIsHidden(true);
      }
      resetSearchTextAndMatches();
    },
    [selectedActionNode, autoHide, resetSearchTextAndMatches],
  );

  const runSearch = React.useCallback(
    async (preserveSelection = false) => {
      const controller = new AbortController();
      searchAbortController.current = controller;

      try {
        const { matchingText, matchingLinksAndButtons, suggestions, isFuzzy } =
          await new FindInPage(searchText).findMatches({ signal: controller.signal });

        if (controller.signal.aborted) {
          return;
        }

        setIsFuzzy(isFuzzy);
        setRankedMatches(suggestions);
        setSearchResults(matchingText, matchingLinksAndButtons, preserveSelection);
        setScrollOrResizeRefresh(refresh => !refresh);
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          console.error(`${EXTENSION_NAME} search failed:`, error);
        }
      }
    },
    [searchText, setSearchResults],
  );

  const updateSelectionPositionsAfterTimeout = React.useCallback(() => {
    setHideSelections(true);
    if (scrollOrResizeUpdateTimeout.current) {
      window.clearTimeout(scrollOrResizeUpdateTimeout.current);
    }
    scrollOrResizeUpdateTimeout.current = window.setTimeout(() => {
      setScrollOrResizeRefresh(refresh => !refresh);
      setHideSelections(false);
    }, SCROLL_OR_RESIZE_UPDATE_TIMEOUT_DURATION);
  }, []);

  const scheduleSearch = React.useCallback(
    (preserveSelection = false) => {
      cancelPendingSearch();
      if (!preserveSelection) {
        clearSearchResults();
        // Cleared results are not approximate ones. Leaving this set would mark the next
        // query as approximate before it has even run.
        setIsFuzzy(false);
        setRankedMatches([]);
        Utils.clearPageSelection();
      }
      if (searchText.trimStart().length === 0) return;
      void runSearch(preserveSelection);
    },
    [cancelPendingSearch, clearSearchResults, runSearch, searchText],
  );

  const suggestions = useSuggestions({ suggestions: rankedMatches, searchText, isFuzzy });

  // Shared by stepping through matches and by jumping straight to a numbered row, so both
  // routes leave the same mode, selection, scroll position and page selection behind.
  const selectMatchAtIndex = React.useCallback(
    (mode: SearchMode, index: number) => {
      const matches = mode === SEARCH_MODES.TEXT ? matchingTextNodes : matchingLinksAndButtons;
      setMode(mode);
      setSelectedIndex(mode, index);
      Utils.scrollToNodeAtIndexInList(matches, index);
      if (mode === SEARCH_MODES.TEXT) {
        Utils.selectNodeContents(matches[index]!);
      } else {
        Utils.clearPageSelection();
      }
      setScrollOrResizeRefresh(refresh => !refresh);
    },
    [matchingTextNodes, matchingLinksAndButtons, setMode, setSelectedIndex],
  );

  const selectNextMatchingNode = React.useCallback(
    (event: KeyboardEvent, mode: SearchMode, forward = true) => {
      const matches = mode === SEARCH_MODES.TEXT ? matchingTextNodes : matchingLinksAndButtons;
      if (matches.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const currentIndex = searchNavigation.selectedIndices[mode];
      selectMatchAtIndex(
        mode,
        currentIndex === null
          ? forward
            ? 0
            : matches.length - 1
          : (currentIndex + (forward ? 1 : matches.length - 1)) % matches.length,
      );
    },
    [
      matchingTextNodes,
      matchingLinksAndButtons,
      searchNavigation.selectedIndices,
      selectMatchAtIndex,
    ],
  );

  const preventDefaultAndClearSearchText = React.useCallback((event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSearchText('');
  }, []);

  const guarded = React.useCallback(
    (handler: ShortcutHandler): ShortcutHandler =>
      event => {
        if (isInteractive) {
          handler(event);
        }
      },
    [isInteractive],
  );

  // 'current' keeps Tab inside whichever mode is active instead of forcing text mode.
  const createNavigationShortcutHandler = React.useCallback(
    (mode: SearchMode | 'current', forward = true): ShortcutHandler =>
      guarded(event => {
        const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
        if (Utils.elementIsActive(searchInputRef.current) || !differentInputIsActive) {
          selectNextMatchingNode(event, mode === 'current' ? navigationMode : mode, forward);
        }
      }),
    [guarded, selectNextMatchingNode, navigationMode],
  );

  // Jumps straight to a row of the results panel. The row carries its own kind, so a number
  // can land on an action while the bar is in text mode, and the mode follows it.
  const selectSuggestion = React.useCallback(
    (position: number) => {
      const suggestion = suggestions[position];
      if (!isInteractive || !suggestion) return false;
      const mode = suggestion.kind === 'action' ? SEARCH_MODES.ACTIONS : SEARCH_MODES.TEXT;
      const matches = mode === SEARCH_MODES.TEXT ? matchingTextNodes : matchingLinksAndButtons;
      const index = matches.indexOf(suggestion.node);
      // A listed node that is no longer among the matches has nothing to select.
      if (index === -1) return false;
      selectMatchAtIndex(mode, index);
      return true;
    },
    [isInteractive, suggestions, matchingTextNodes, matchingLinksAndButtons, selectMatchAtIndex],
  );

  const selectListedMatch = React.useCallback(
    (position: number): ShortcutHandler =>
      guarded(event => {
        if (!selectSuggestion(position)) return;
        event.preventDefault();
        event.stopPropagation();
      }),
    [guarded, selectSuggestion],
  );

  const toggleAutoHide = React.useCallback(() => {
    updateAutoHide(!autoHide);
  }, [autoHide, updateAutoHide]);

  const keyboardShortcutHandlerMapping = React.useMemo<
    Record<KeyboardShortcutName, ShortcutHandler | null>
  >(() => {
    return {
      next_match: createNavigationShortcutHandler('current'),
      previous_match: createNavigationShortcutHandler('current', false),
      next_action_match: createNavigationShortcutHandler(SEARCH_MODES.ACTIONS),
      previous_action_match: createNavigationShortcutHandler(SEARCH_MODES.ACTIONS, false),
      select_match: guarded(event => activateSelectedMatchingNodeAndReset(event)),
      open_match_in_foreground_tab: guarded(event =>
        activateSelectedMatchingNodeAndReset(event, 'foreground-tab'),
      ),
      open_match_in_background_tab: guarded(event =>
        activateSelectedMatchingNodeAndReset(event, 'background-tab'),
      ),
      toggle_search_mode: guarded(event => {
        event.preventDefault();
        event.stopPropagation();
        setMode(chosenMode === SEARCH_MODES.TEXT ? SEARCH_MODES.ACTIONS : SEARCH_MODES.TEXT);
      }),
      // The browser's native copy command emits the document copy event handled by handleCopy.
      copy_selected_link: null,
      clear_searchbar: guarded(event => {
        if (!Utils.differentInputIsActive(searchInputRef.current)) {
          preventDefaultAndClearSearchText(event);
        }
      }),
      focus_searchbar: event => {
        event.preventDefault();
        event.stopPropagation();
        revealAndFocus();
      },
      select_listed_match_1: selectListedMatch(0),
      select_listed_match_2: selectListedMatch(1),
      select_listed_match_3: selectListedMatch(2),
      clear_search_or_hide: event => {
        const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
        if (!isInteractive || differentInputIsActive) return;
        if (searchText.length > 0) {
          preventDefaultAndClearSearchText(event);
        } else {
          event.preventDefault();
          event.stopPropagation();
          hide();
          searchInputRef.current?.blur();
        }
      },
    };
  }, [
    createNavigationShortcutHandler,
    guarded,
    selectListedMatch,
    chosenMode,
    setMode,
    activateSelectedMatchingNodeAndReset,
    preventDefaultAndClearSearchText,
    revealAndFocus,
    isInteractive,
    searchText,
    hide,
  ]);

  const handleShortcut = React.useCallback(
    (keyboardShortcutName: KeyboardShortcutName, event: KeyboardEvent) => {
      const target = event.composedPath()[0] ?? event.target;
      if (
        keyboardShortcutName !== 'focus_searchbar' &&
        (Utils.differentInputIsActive(searchInputRef.current) ||
          (target !== searchInputRef.current && Utils.isExtensionElement(target)))
      ) {
        return;
      }
      const keyboardEventHandler = keyboardShortcutHandlerMapping[keyboardShortcutName];
      keyboardEventHandler?.(event);
    },
    [keyboardShortcutHandlerMapping],
  );

  const handleKeydown = React.useCallback(
    (event: KeyboardEvent) => {
      const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
      if (
        !event.isComposing &&
        !event.defaultPrevented &&
        !Utils.isExtensionElement(event.composedPath()[0] ?? event.target) &&
        !differentInputIsActive &&
        !Utils.elementIsActive(searchInputRef.current) &&
        Utils.keyValidForFocus(event.key) &&
        !event.metaKey &&
        !event.altKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        setSearchText(`${searchText}${event.key}`);
        revealAndFocus();
      }
    },
    [revealAndFocus, searchText],
  );

  const handleCopy = React.useCallback(
    (event: ClipboardEvent) => {
      if (
        !isInteractive ||
        !event.clipboardData ||
        Utils.differentInputIsActive(searchInputRef.current)
      ) {
        return;
      }
      const target = event.composedPath()[0] ?? event.target;
      if (target !== searchInputRef.current && Utils.isExtensionElement(target)) return;
      const copyText = selectedTextMatch?.node.isConnected
        ? visibleText(selectedTextMatch.node)
        : selectedActionNode?.isConnected
          ? Utils.linkUrlForNode(selectedActionNode)
          : null;
      if (copyText === null) {
        return;
      }
      event.preventDefault();
      event.clipboardData.setData('text/plain', copyText);
    },
    [isInteractive, selectedTextMatch, selectedActionNode],
  );

  React.useEffect(() => {
    if (searchText !== previousSearchText.current) {
      previousSearchText.current = searchText;
      scheduleSearch();
    }
  }, [searchText, scheduleSearch]);

  const hasSearchQuery = searchText.trimStart().length > 0;
  const refreshSearchOnPageChange = React.useEffectEvent(() => scheduleSearch(true));
  React.useEffect(() => {
    if (!isInteractive || !hasSearchQuery) return undefined;
    return subscribeToPageChanges(() => refreshSearchOnPageChange());
  }, [isInteractive, hasSearchQuery]);

  React.useEffect(() => {
    if (selectedTextMatch?.node.isConnected) {
      Utils.selectNodeContents(selectedTextMatch.node);
      return () => Utils.clearPageSelection();
    }
    return undefined;
  }, [selectedTextMatch]);

  React.useEffect(() => {
    return () => {
      cancelPendingSearch();
      if (scrollOrResizeUpdateTimeout.current) {
        window.clearTimeout(scrollOrResizeUpdateTimeout.current);
      }
    };
  }, [cancelPendingSearch]);

  // The stored default arrives after the first render, and can change from the panel or
  // another tab, so adopt it whenever it actually changes.
  React.useEffect(() => {
    if (defaultSearchMode !== previousDefaultSearchMode.current) {
      previousDefaultSearchMode.current = defaultSearchMode;
      setMode(defaultSearchMode);
    }
  }, [defaultSearchMode, setMode]);

  React.useEffect(() => {
    if (autoHide !== previousAutoHide.current) {
      previousAutoHide.current = autoHide;

      if (autoHide) {
        hide();
      } else {
        setIsHidden(false);
        focusSearchInput();
      }
    }
  }, [autoHide, hide, focusSearchInput]);

  // The panel is a second view of the one cursor, not a cursor of its own, so a row is
  // highlighted only when Tab has actually landed on it.
  const selectedSuggestionNode =
    (navigationMode === SEARCH_MODES.TEXT
      ? (selectedTextMatch?.node ?? null)
      : selectedActionNode) ?? null;
  // Opens downwards whenever the list actually fits there, rather than assuming it will not
  // just because the bar sits in the lower half of the page. The height is estimated, since
  // the side has to be chosen before the list has been laid out; erring high only means
  // opening upwards a little sooner than strictly necessary.
  const suggestionsAbove = React.useMemo(() => {
    if (suggestions.length === 0) return false;
    const barBottom = popupPosition.y * windowSize.height + KEYMOVE_CONTAINER_HEIGHT / 2;
    const listHeight = suggestions.length * SUGGESTION_ROW_HEIGHT + SUGGESTION_PANEL_PADDING;
    return windowSize.height - barBottom < listHeight;
  }, [suggestions.length, popupPosition.y, windowSize.height]);
  const activeSuggestionIndex = React.useMemo(() => {
    if (!selectedSuggestionNode) return null;
    const index = suggestions.findIndex(item => item.node === selectedSuggestionNode);
    return index === -1 ? null : index;
  }, [suggestions, selectedSuggestionNode]);

  const hasActiveMatches = activeMatchingNodes.length > 0;

  const shouldBindEvents = isInteractive && hasActiveMatches;

  useWindowEvent('scroll', shouldBindEvents, updateSelectionPositionsAfterTimeout);
  useWindowEvent('wheel', shouldBindEvents, updateSelectionPositionsAfterTimeout);
  useWindowEvent('resize', shouldBindEvents, updateSelectionPositionsAfterTimeout);
  useDocumentEvent('keydown', alwaysOn, handleKeydown, true);
  useDocumentEvent(
    'copy',
    selectedTextMatch !== null || selectedActionLinkUrl !== null,
    handleCopy,
    true,
  );
  useKeyboardShortcuts(handleShortcut);
  useHighlights({
    matches: matchingText,
    selectedMatch: selectedTextMatch,
    enabled: highlightMatches,
    color: highlightColors[SEARCH_MODES.TEXT],
  });
  useExtensionMessaging();

  return (
    <div className={isInteractive ? '' : 'keymove-hidden'}>
      {!hideSelections && (
        <Selections
          color={highlightColors[navigationMode]}
          refresh={scrollOrResizeRefresh}
          selectedSelectionIndex={
            navigationMode === SEARCH_MODES.TEXT && selectedSelectionIndex !== null
              ? 0
              : selectedSelectionIndex
          }
          matchingNodes={
            navigationMode === SEARCH_MODES.TEXT
              ? selectedTextMatch
                ? [selectedTextMatch.node]
                : []
              : matchingLinksAndButtons
          }
        />
      )}
      <DraggableContainer
        className={suggestionsAbove ? 'keymove-container-suggestions-above' : undefined}
        width={popupWidth}
        updateWidth={updatePopupWidth}
        containerRef={containerRef}
        searchInputRef={searchInputRef}
        position={popupPosition}
        updatePosition={updatePopupPosition}
      >
        <div id={'keymove-bar'}>
          <Logo />
          <SearchInput
            inputRef={searchInputRef}
            searchText={searchText}
            suggestionCount={suggestions.length}
            activeSuggestionIndex={activeSuggestionIndex}
            onBlur={handleBlur}
            updateSearchText={setSearchText}
          />
          <MatchesSummary
            mode={navigationMode}
            hasSearchQuery={hasSearchQuery}
            isFuzzy={isFuzzy}
            selectedSelectionIndex={selectedSelectionIndex}
            resultCount={activeMatchingNodes.length}
          />
          {isInteractive && showAutohideButton && (
            <VisibilityButton autoHide={autoHide} toggleAutoHide={toggleAutoHide} />
          )}
          {isInteractive && <InfoDropdown />}
        </div>
        {isInteractive && (
          <ResultsPanel
            suggestions={suggestions}
            selectedNode={selectedSuggestionNode}
            above={suggestionsAbove}
            onSelect={selectSuggestion}
          />
        )}
      </DraggableContainer>
    </div>
  );
};

export default Searchbar;
