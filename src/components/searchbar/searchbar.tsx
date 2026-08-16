import React from 'react';
import useWindowEvent from '../../hooks/use_window_event.js';
import useDocumentEvent from '../../hooks/use_document_event.js';
import useHighlights from '../../hooks/use_highlights.js';
import useKeyboardShortcuts from '../../hooks/use_keyboard_shortcuts.js';
import useStoredSettings from '../../hooks/use_stored_settings.js';
import useUrlChangeSubscription from '../../hooks/use_url_change_subscription.js';
import useExtensionMessaging from '../../hooks/use_extension_messaging.js';
import useSearchNavigation, { SEARCH_MODES } from '../../hooks/use_search_navigation.js';

import Utils from '../../lib/utils.js';
import FindInPage from '../../lib/find_in_page.js';
import SearchInput from './search_input.js';
import Selections from './selections.js';
import MatchesSummary from './matches_summary.js';
import DraggableContainer from './draggable_container.js';
import InfoDropdown from './info_dropdown.js';
import VisibilityButton from './visibility_button.js';
import Logo from '../../icons/logo-without-color.svg?react';

const SCROLL_OR_RESIZE_UPDATE_TIMEOUT_DURATION = 100;
const SEARCH_TEXT_UPDATE_TIMEOUT_DURATION = 150;
type ShortcutHandler = (event: KeyboardEvent) => void;

const Searchbar = () => {
  const scrollOrResizeUpdateTimeout = React.useRef<number | undefined>(undefined);
  const selectionUpdateTimeout = React.useRef<number | undefined>(undefined);
  const searchAbortController = React.useRef<AbortController | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { host } = useUrlChangeSubscription();
  const [prevHost, setPrevHost] = React.useState(host);

  const {
    autoHide,
    updateAutoHide,
    useOnEveryWebsite,
    updateUseOnEveryWebsite,
    alwaysOn,
    updateAlwaysOn,
  } = useStoredSettings();
  const {
    state: searchNavigation,
    setResults: setSearchResults,
    clearResults: clearSearchResults,
    setSelectedIndex,
  } = useSearchNavigation();

  const [isHidden, setIsHidden] = React.useState<boolean>(autoHide);
  const [prevAutoHide, setPrevAutoHide] = React.useState<boolean>(autoHide);
  const [isDisabled, setIsDisabled] = React.useState<boolean>(
    !useOnEveryWebsite && !Utils.hostIsGmail(),
  );
  const [temporarilyEnabled, setTemporarilyEnabled] = React.useState<boolean>(false);
  const [prevUseOnEveryWebsite, setPrevUseOnEveryWebsite] =
    React.useState<boolean>(useOnEveryWebsite);
  const [searchText, setSearchText] = React.useState('');
  const [prevSearchText, setPrevSearchText] = React.useState('');
  const [scrollOrResizeRefresh, setScrollOrResizeRefresh] = React.useState<boolean>(false);
  const [hideSelections, setHideSelections] = React.useState<boolean>(false);

  const matchingNodes = searchNavigation.results.text;
  const matchingLinksAndButtons = searchNavigation.results.actions;
  const selectedSelectionIndex = searchNavigation.selectedIndices.actions;

  const focusSearchInput = React.useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const cancelPendingSearch = React.useCallback(() => {
    if (selectionUpdateTimeout.current) {
      window.clearTimeout(selectionUpdateTimeout.current);
    }
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
  }, []);

  const resetSearchTextAndMatches = React.useCallback(() => {
    cancelPendingSearch();
    setSearchText('');
    clearSearchResults();
  }, [cancelPendingSearch, clearSearchResults]);

  const resetTemporarilyEnabled = React.useCallback(() => {
    if (isDisabled && temporarilyEnabled) {
      setTemporarilyEnabled(false);
    }
  }, [isDisabled, temporarilyEnabled]);

  const hide = React.useCallback(() => {
    setIsHidden(true);
    resetSearchTextAndMatches();
    resetTemporarilyEnabled();
  }, [resetSearchTextAndMatches, resetTemporarilyEnabled]);

  const handleBlur = React.useCallback(() => {
    if (autoHide) {
      setIsHidden(true);
    }
    resetSearchTextAndMatches();
    resetTemporarilyEnabled();
  }, [autoHide, resetSearchTextAndMatches, resetTemporarilyEnabled]);

  const clickSelectedMatchingNodeAndReset = React.useCallback(
    (event: KeyboardEvent) => {
      if (matchingLinksAndButtons.length > 0) {
        event.preventDefault();
        event.stopPropagation();

        const node = matchingLinksAndButtons[selectedSelectionIndex];
        if (!node) {
          return;
        }
        Utils.clickOrFocusNode(node);

        if (autoHide) {
          setIsHidden(true);
        }
        resetSearchTextAndMatches();
      }
    },
    [matchingLinksAndButtons, selectedSelectionIndex, resetSearchTextAndMatches, autoHide],
  );

  const updateMatchingNodesAndScrollToSelectedIndex = React.useCallback(async () => {
    const controller = new AbortController();
    searchAbortController.current = controller;

    try {
      const { matchingNodes, matchingLinksAndButtons, bestMatchingLinkOrButtonIndex } =
        await new FindInPage(searchText).findMatches({ signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      const selectedIndex = bestMatchingLinkOrButtonIndex ?? 0;
      setSearchResults(matchingNodes, matchingLinksAndButtons, selectedIndex);

      if (matchingLinksAndButtons.length > 0) {
        Utils.scrollToNodeAtIndexInList(matchingLinksAndButtons, selectedIndex);
        setScrollOrResizeRefresh(refresh => !refresh);
      }
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('YipYip search failed:', error);
      }
    }
  }, [searchText, setSearchResults]);

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

  const updateSelectionAndScrollToSelectedAfterTimeout = React.useCallback(() => {
    cancelPendingSearch();
    clearSearchResults();

    selectionUpdateTimeout.current = window.setTimeout(() => {
      updateMatchingNodesAndScrollToSelectedIndex();
    }, SEARCH_TEXT_UPDATE_TIMEOUT_DURATION);
  }, [cancelPendingSearch, clearSearchResults, updateMatchingNodesAndScrollToSelectedIndex]);

  const preventDefaultEventAndSelectNextMatchingNode = React.useCallback(
    (event: KeyboardEvent, forward = true) => {
      event.preventDefault();
      event.stopPropagation();

      if (matchingLinksAndButtons.length > 1) {
        const newSelectedSelectionIndex =
          (selectedSelectionIndex + (forward ? 1 : matchingLinksAndButtons.length - 1)) %
          matchingLinksAndButtons.length;
        setSelectedIndex(SEARCH_MODES.ACTIONS, newSelectedSelectionIndex);
        Utils.scrollToNodeAtIndexInList(matchingLinksAndButtons, newSelectedSelectionIndex);
        setScrollOrResizeRefresh(refresh => !refresh);
      }
    },
    [matchingLinksAndButtons, selectedSelectionIndex, setSelectedIndex],
  );

  const preventDefaultAndClearSearchText = React.useCallback((event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setSearchText('');
  }, []);

  const handleNextMatchShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
      if (
        !isHidden &&
        (!isDisabled || temporarilyEnabled) &&
        (Utils.elementIsActive(searchInputRef.current) || !differentInputIsActive)
      ) {
        preventDefaultEventAndSelectNextMatchingNode(event);
      }
    },
    [isHidden, isDisabled, temporarilyEnabled, preventDefaultEventAndSelectNextMatchingNode],
  );

  const handlePreviousMatchShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
      if (
        !isHidden &&
        (!isDisabled || temporarilyEnabled) &&
        (Utils.elementIsActive(searchInputRef.current) || !differentInputIsActive)
      ) {
        preventDefaultEventAndSelectNextMatchingNode(event, false);
      }
    },
    [isHidden, isDisabled, temporarilyEnabled, preventDefaultEventAndSelectNextMatchingNode],
  );

  const handleSelectShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      if ((!isDisabled || temporarilyEnabled) && !isHidden) {
        clickSelectedMatchingNodeAndReset(event);
      }
    },
    [isHidden, isDisabled, temporarilyEnabled, clickSelectedMatchingNodeAndReset],
  );

  const handleClearShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
      if ((!isDisabled || temporarilyEnabled) && !isHidden && !differentInputIsActive) {
        preventDefaultAndClearSearchText(event);
      }
    },
    [isHidden, isDisabled, temporarilyEnabled, preventDefaultAndClearSearchText],
  );

  const handleFocusShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      if (!isDisabled || temporarilyEnabled) {
        event.preventDefault();
        event.stopPropagation();
        setIsHidden(false);
        focusSearchInput();
      }
    },
    [focusSearchInput, isDisabled, temporarilyEnabled],
  );

  const toggleUseOnEveryWebsite = React.useCallback(() => {
    updateUseOnEveryWebsite(!useOnEveryWebsite);
  }, [useOnEveryWebsite, updateUseOnEveryWebsite]);

  const toggleAutoHide = React.useCallback(() => {
    updateAutoHide(!autoHide);
  }, [autoHide, updateAutoHide]);

  const toggleAlwaysOn = React.useCallback(() => {
    updateAlwaysOn(!alwaysOn);
  }, [alwaysOn, updateAlwaysOn]);

  const handleToggleAutohideShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      if (!isDisabled || temporarilyEnabled) {
        event.preventDefault();
        toggleAutoHide();
      }
    },
    [toggleAutoHide, isDisabled, temporarilyEnabled],
  );

  const handleClearSearchOrHideShortcut = React.useCallback(
    (event: KeyboardEvent) => {
      const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
      const isEnabled = (!isDisabled || temporarilyEnabled) && !isHidden && !differentInputIsActive;
      if (isEnabled && searchText.length > 0) {
        preventDefaultAndClearSearchText(event);
      } else if (isEnabled && Utils.elementIsActive(searchInputRef.current)) {
        searchInputRef.current?.blur();
      } else {
        handleBlur();
      }
    },
    [
      searchText,
      preventDefaultAndClearSearchText,
      isDisabled,
      temporarilyEnabled,
      isHidden,
      handleBlur,
    ],
  );

  const keyboardShortcutHandlerMapping = React.useMemo<Record<string, ShortcutHandler>>(() => {
    return {
      next_match: handleNextMatchShortcut,
      previous_match: handlePreviousMatchShortcut,
      select_match: handleSelectShortcut,
      clear_searchbar: handleClearShortcut,
      focus_searchbar: handleFocusShortcut,
      toggle_autohide: handleToggleAutohideShortcut,
      clear_search_or_hide: handleClearSearchOrHideShortcut,
    };
  }, [
    handleNextMatchShortcut,
    handlePreviousMatchShortcut,
    handleSelectShortcut,
    handleClearShortcut,
    handleFocusShortcut,
    handleToggleAutohideShortcut,
    handleClearSearchOrHideShortcut,
  ]);

  const handleShortcut = React.useCallback(
    (keyboardShortcutName: string, event: KeyboardEvent) => {
      const keyboardEventHandler = keyboardShortcutHandlerMapping[keyboardShortcutName];
      if (keyboardEventHandler) {
        keyboardEventHandler(event);
      }
    },
    [keyboardShortcutHandlerMapping],
  );

  const handleKeydown = React.useCallback(
    (event: KeyboardEvent) => {
      const differentInputIsActive = Utils.differentInputIsActive(searchInputRef.current);
      if (
        !differentInputIsActive &&
        !Utils.elementIsActive(searchInputRef.current) &&
        Utils.keyValidForFocus(event.key) &&
        !event.metaKey &&
        !event.altKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        setIsHidden(false);
        setSearchText(`${searchText}${event.key}`);
        focusSearchInput();
      }
    },
    [focusSearchInput, searchText],
  );

  const handleToolbarActionClicked = React.useCallback(() => {
    if (isDisabled) {
      setTemporarilyEnabled(true);
    }

    setIsHidden(false);
    focusSearchInput();
  }, [isDisabled, focusSearchInput]);

  React.useEffect(() => {
    if (searchText !== prevSearchText) {
      setPrevSearchText(searchText);
      updateSelectionAndScrollToSelectedAfterTimeout();
    }
  }, [searchText, prevSearchText, updateSelectionAndScrollToSelectedAfterTimeout]);

  React.useEffect(() => {
    return () => {
      cancelPendingSearch();
      if (scrollOrResizeUpdateTimeout.current) {
        window.clearTimeout(scrollOrResizeUpdateTimeout.current);
      }
    };
  }, [cancelPendingSearch]);

  React.useEffect(() => {
    if (autoHide !== prevAutoHide) {
      setPrevAutoHide(autoHide);

      if (autoHide) {
        hide();
      } else {
        setIsHidden(false);

        if (!isDisabled || temporarilyEnabled) {
          focusSearchInput();
        }
      }
    }
  }, [autoHide, prevAutoHide, hide, focusSearchInput, isDisabled, temporarilyEnabled]);

  React.useEffect(() => {
    const useOnEveryWebsiteChanged = useOnEveryWebsite !== prevUseOnEveryWebsite;
    if (useOnEveryWebsiteChanged) {
      setPrevUseOnEveryWebsite(useOnEveryWebsite);
    }

    const hostChanged = host !== prevHost;
    if (hostChanged) {
      setPrevHost(host);
    }

    if (useOnEveryWebsiteChanged || hostChanged) {
      const newIsDisabled = !useOnEveryWebsite && !Utils.hostIsGmail();
      setIsDisabled(newIsDisabled);
      if (newIsDisabled) {
        resetSearchTextAndMatches();
      } else if (temporarilyEnabled) {
        setTemporarilyEnabled(false);
      }
    }
  }, [
    useOnEveryWebsite,
    prevUseOnEveryWebsite,
    resetSearchTextAndMatches,
    temporarilyEnabled,
    host,
    prevHost,
  ]);

  const hasMatchingLinksOrButtons = React.useMemo(
    () => matchingLinksAndButtons.length > 0,
    [matchingLinksAndButtons],
  );

  const shouldBindEvents = React.useMemo(() => {
    return (!isDisabled || temporarilyEnabled) && !isHidden && hasMatchingLinksOrButtons;
  }, [isDisabled, temporarilyEnabled, isHidden, hasMatchingLinksOrButtons]);

  useWindowEvent('scroll', shouldBindEvents, updateSelectionPositionsAfterTimeout);
  useWindowEvent('wheel', shouldBindEvents, updateSelectionPositionsAfterTimeout);
  useWindowEvent('resize', shouldBindEvents, updateSelectionPositionsAfterTimeout);
  useDocumentEvent('keydown', (!isDisabled || temporarilyEnabled) && alwaysOn, handleKeydown, true);
  useKeyboardShortcuts(handleShortcut);
  useHighlights({ searchText, matchingNodes });
  useExtensionMessaging({ handleToolbarActionClicked });

  return (
    <div className={(isDisabled && !temporarilyEnabled) || isHidden ? 'yipyip-hidden' : ''}>
      {!hideSelections && (
        <Selections
          refresh={scrollOrResizeRefresh}
          selectedSelectionIndex={selectedSelectionIndex}
          matchingLinksAndButtons={matchingLinksAndButtons}
        />
      )}
      <DraggableContainer containerRef={containerRef} searchInputRef={searchInputRef}>
        <Logo />
        <SearchInput
          inputRef={searchInputRef}
          searchText={searchText}
          onBlur={handleBlur}
          updateSearchText={setSearchText}
        />
        <MatchesSummary
          selectedSelectionIndex={selectedSelectionIndex}
          matchingLinksAndButtons={matchingLinksAndButtons}
        />
        <VisibilityButton autoHide={autoHide} toggleAutoHide={toggleAutoHide} />
        <InfoDropdown
          temporarilyEnabled={temporarilyEnabled}
          autoHide={autoHide}
          toggleAutoHide={toggleAutoHide}
          useOnEveryWebsite={useOnEveryWebsite}
          toggleUseOnEveryWebsite={toggleUseOnEveryWebsite}
          alwaysOn={alwaysOn}
          toggleAlwaysOn={toggleAlwaysOn}
        />
      </DraggableContainer>
    </div>
  );
};

export default Searchbar;
