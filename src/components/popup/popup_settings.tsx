import React from 'react';
import useStoredSettings from '../../hooks/use_stored_settings.js';
import useHighlightColors from '../../hooks/use_highlight_colors.js';
import usePopupPosition from '../../hooks/use_popup_position.js';
import usePopupWidth from '../../hooks/use_popup_width.js';
import InfoPanelSectionHeader from '../searchbar/info_panel/info_panel_section_header.js';
import InfoPanelShortcutRow from '../searchbar/info_panel/info_panel_shortcut_row.js';
import PopupPositionGrid from './popup_position_grid.js';
import { keyboardShortcuts } from '../../lib/static_data.js';
import Utils from '../../lib/utils.js';
import type { DisplayableKeyboardShortcut } from '../searchbar/info_panel/info_panel_shortcut_row.js';
import InfoPanelSettings from '../searchbar/info_panel/info_panel_settings.js';
import InfoPanelButtons from '../searchbar/info_panel/info_panel_buttons.js';

// The popup shares the settings hooks with the content script rather than talking to it.
// Every setting is stored in browser.storage.local and every open tab already reacts to
// storage change events, so a write here reaches all of them without any messaging.
const PopupSettings = () => {
  const {
    autoHide,
    updateAutoHide,
    alwaysOn,
    updateAlwaysOn,
    startInActionMode,
    updateStartInActionMode,
    highlightMatches,
    updateHighlightMatches,
    showAutohideButton,
    updateShowAutohideButton,
  } = useStoredSettings();
  const { resetPosition } = usePopupPosition();
  const { width: popupWidth, resetWidth } = usePopupWidth();
  const {
    colors: highlightColors,
    updateColor: updateHighlightColor,
    resetColors: resetHighlightColors,
  } = useHighlightColors();

  const toggleAutoHide = React.useCallback(
    () => updateAutoHide(!autoHide),
    [autoHide, updateAutoHide],
  );
  const toggleAlwaysOn = React.useCallback(
    () => updateAlwaysOn(!alwaysOn),
    [alwaysOn, updateAlwaysOn],
  );
  const toggleStartInActionMode = React.useCallback(
    () => updateStartInActionMode(!startInActionMode),
    [startInActionMode, updateStartInActionMode],
  );
  const toggleHighlightMatches = React.useCallback(
    () => updateHighlightMatches(!highlightMatches),
    [highlightMatches, updateHighlightMatches],
  );
  const toggleShowAutohideButton = React.useCallback(
    () => updateShowAutohideButton(!showAutohideButton),
    [showAutohideButton, updateShowAutohideButton],
  );

  const focusShortcut = keyboardShortcuts.find(
    (shortcut): shortcut is DisplayableKeyboardShortcut =>
      shortcut.name === 'focus_searchbar' && Boolean(shortcut.text && shortcut.displayKeys),
  );

  return (
    <div id={'keymove-popup'}>
      <InfoPanelSectionHeader text={'Settings'} />
      {focusShortcut && (
        <div className={'keymove-popup-reminder'}>
          <InfoPanelShortcutRow isMacOS={Utils.isMacOS()} shortcut={focusShortcut} />
          <p className={'keymove-popup-hint'}>
            {'Hover over the ? in the searchbar to see the navigation shortcuts.'}
          </p>
        </div>
      )}
      <InfoPanelSettings
        autoHide={autoHide}
        toggleAutoHide={toggleAutoHide}
        alwaysOn={alwaysOn}
        toggleAlwaysOn={toggleAlwaysOn}
        startInActionMode={startInActionMode}
        toggleStartInActionMode={toggleStartInActionMode}
        highlightMatches={highlightMatches}
        toggleHighlightMatches={toggleHighlightMatches}
        showAutohideButton={showAutohideButton}
        toggleShowAutohideButton={toggleShowAutohideButton}
        highlightColors={highlightColors}
        updateHighlightColor={updateHighlightColor}
        resetHighlightColors={resetHighlightColors}
      />
      <InfoPanelSectionHeader marginTop text={'Searchbar position and size'} />
      <PopupPositionGrid />
      <p className={'keymove-popup-hint'}>
        {`Drag the right edge of the searchbar to resize it. Currently ${popupWidth} pixels wide.`}
      </p>
      <button
        type="button"
        className={'keymove-info-panel-reset-position-button'}
        onClick={() => {
          resetPosition();
          resetWidth();
        }}
      >
        {'Reset position and size'}
      </button>
      <div className={'keymove-popup-links'}>
        <InfoPanelButtons />
      </div>
    </div>
  );
};

export default PopupSettings;
