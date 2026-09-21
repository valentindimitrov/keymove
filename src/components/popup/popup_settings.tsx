import React from 'react';
import { browser } from 'wxt/browser';
import useStoredSettings from '../../hooks/use_stored_settings.js';
import useInteractionSettings from '../../hooks/use_interaction_settings.js';
import useHighlightColors from '../../hooks/use_highlight_colors.js';
import usePopupPosition from '../../hooks/use_popup_position.js';
import usePopupWidth from '../../hooks/use_popup_width.js';
import useTheme from '../../hooks/use_theme.js';
import InfoPanelSettingRow from '../searchbar/info_panel/info_panel_setting_row.js';
import InfoPanelColorRow from '../searchbar/info_panel/info_panel_color_row.js';
import InfoPanelKeyboardShortcuts from '../searchbar/info_panel/info_panel_keyboard_shortcuts.js';
import InfoPanelButtons from '../searchbar/info_panel/info_panel_buttons.js';
import PopupPositionGrid from './popup_position_grid.js';
import SuggestionCountSetting from './suggestion_count_setting.js';
import ThemeSetting from './theme_setting.js';
import SettingsTabs from './settings_tabs.js';
import OpeningShortcutSetting from './opening_shortcut_setting.js';
import SiteSettings from './site_settings.js';
import ShowSearchButton from './show_search_button.js';
import ExtensionMessageTypes from '../../extension_message_types.js';
import { isRecord } from '../../lib/runtime_schema.js';
import { isInjectableUrl } from '../../lib/extension_tabs.js';
import { openingShortcutKeys, siteHostname } from '../../lib/interaction_settings_schema.js';
import Utils from '../../lib/utils.js';
import { EXTENSION_NAME } from '../../extension_identity.js';
import Logo from '../../icons/logo-color.svg?react';

export type PopupSettingsModel = {
  settings: ReturnType<typeof useStoredSettings>;
  interaction: ReturnType<typeof useInteractionSettings>;
  colors: ReturnType<typeof useHighlightColors>;
  position: ReturnType<typeof usePopupPosition>;
  width: ReturnType<typeof usePopupWidth>;
  hostname: string | null;
  onShowSearch: () => Promise<void>;
  searchUnavailable: string | null;
};

export function PopupSettingsView({
  settings: s,
  interaction,
  colors,
  position,
  width,
  hostname,
  onShowSearch,
  searchUnavailable,
}: PopupSettingsModel) {
  const activationId = React.useId();
  return (
    <div id="keymove-popup">
      <header className="keymove-settings-header">
        <span>
          <Logo aria-hidden="true" />
          {EXTENSION_NAME}
        </span>
        <ShowSearchButton onShow={onShowSearch} unavailable={searchUnavailable} />
      </header>
      {interaction.error && <p role="alert">{interaction.error}</p>}
      <SettingsTabs>
        {tab => (
          <>
            {tab === 'General' && (
              <>
                <label className="keymove-settings-field" htmlFor={activationId}>
                  <span>
                    Default activation
                    <span
                      className="keymove-info-panel-setting-description"
                      id={activationId + '-hint'}
                    >
                      For sites without an override.
                    </span>
                  </span>
                  <select
                    id={activationId}
                    aria-label="Default activation"
                    aria-describedby={activationId + '-hint'}
                    value={s.alwaysOn ? 'type' : 'shortcut'}
                    onChange={event => s.updateAlwaysOn(event.target.value === 'type')}
                  >
                    <option value="type">Type to search</option>
                    <option value="shortcut">Shortcut only</option>
                  </select>
                </label>
                <InfoPanelSettingRow
                  label="Start in action mode"
                  description="Begin each search with buttons, links and inputs."
                  value={s.startInActionMode}
                  onChange={() => s.updateStartInActionMode(!s.startInActionMode)}
                />
                <SuggestionCountSetting
                  value={s.suggestionCount}
                  onChange={s.updateSuggestionCount}
                />
                <InfoPanelSettingRow
                  label="Autohide"
                  description="Hide the searchbar when not searching."
                  value={s.autoHide}
                  onChange={() => s.updateAutoHide(!s.autoHide)}
                />
              </>
            )}
            {tab === 'Appearance' && (
              <>
                <ThemeSetting value={s.theme} onChange={s.updateTheme} />
                <InfoPanelSettingRow
                  label="Tooltips mode"
                  description="Show shortcut hints and usage reminders."
                  value={s.tooltipsMode}
                  onChange={() => s.updateTooltipsMode(!s.tooltipsMode)}
                />
                <InfoPanelSettingRow
                  label="Highlight matches"
                  description="Mark matching text and the current result."
                  value={s.highlightMatches}
                  onChange={() => s.updateHighlightMatches(!s.highlightMatches)}
                />
                <InfoPanelColorRow
                  label="Text highlight colour"
                  description="Matching text and its outline."
                  value={colors.colors.text}
                  onChange={value => colors.updateColor('text', value)}
                />
                <InfoPanelColorRow
                  label="Action highlight colour"
                  description="Matching buttons and links."
                  value={colors.colors.actions}
                  onChange={value => colors.updateColor('actions', value)}
                />
                <button
                  type="button"
                  className="keymove-settings-button"
                  onClick={colors.resetColors}
                >
                  Reset highlight colours
                </button>
                <div className="keymove-autohide-setting">
                  <InfoPanelSettingRow
                    label="Show autohide button"
                    description="Keep the eye icon in the searchbar."
                    value={s.showAutohideButton}
                    onChange={() => s.updateShowAutohideButton(!s.showAutohideButton)}
                  />
                </div>
                <h2 className="keymove-settings-heading keymove-layout-heading">
                  Searchbar position and size
                </h2>
                <p className="keymove-popup-hint keymove-layout-hint">
                  Choose where the search bar appears using the nine squares.
                  {s.tooltipsMode &&
                    !s.lockPositionAndSize &&
                    ' Drag the right edge of the searchbar to resize it.'}
                </p>
                <PopupPositionGrid
                  position={position.position}
                  updatePosition={position.updatePosition}
                  disabled={s.lockPositionAndSize}
                />
                <InfoPanelSettingRow
                  label="Lock position and size"
                  description="Prevent accidental dragging and resizing."
                  value={s.lockPositionAndSize}
                  onChange={() => s.updateLockPositionAndSize(!s.lockPositionAndSize)}
                />
                {s.lockPositionAndSize && (
                  <p className="keymove-popup-hint">
                    {'Position and size are locked. Currently ' + width.width + ' pixels wide.'}
                  </p>
                )}
                <button
                  type="button"
                  className="keymove-settings-button"
                  disabled={s.lockPositionAndSize}
                  onClick={() => {
                    position.resetPosition();
                    width.resetWidth();
                  }}
                >
                  Reset position and size
                </button>
              </>
            )}
            {tab === 'Shortcuts' && (
              <>
                <OpeningShortcutSetting
                  value={interaction.openingShortcut}
                  onChange={interaction.updateOpeningShortcut}
                  disabled={!interaction.ready}
                />
                <h2 className="keymove-settings-heading">During a search</h2>
                <InfoPanelKeyboardShortcuts
                  openingShortcut={interaction.openingShortcut}
                  omitOpening
                />
              </>
            )}
            {tab === 'Sites' && (
              <SiteSettings
                hostname={hostname}
                sites={interaction.sites}
                ready={interaction.ready}
                alwaysOn={s.alwaysOn}
                openingLabel={openingShortcutKeys(
                  interaction.openingShortcut,
                  Utils.isMacOS(),
                ).join('+')}
                onChange={interaction.updateSite}
              />
            )}
          </>
        )}
      </SettingsTabs>
      <footer className="keymove-popup-links">
        <InfoPanelButtons compact />
      </footer>
    </div>
  );
}

export default function PopupSettings() {
  const settings = useStoredSettings();
  const interaction = useInteractionSettings();
  const colors = useHighlightColors();
  const position = usePopupPosition();
  const width = usePopupWidth();
  useTheme(settings.theme, document.documentElement);
  const [hostname, setHostname] = React.useState<string | null>(null);
  const [targetId, setTargetId] = React.useState<number | null>(null);
  const [targetReady, setTargetReady] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void Promise.all([
      browser.tabs.query({ active: true, currentWindow: true }),
      browser.tabs.getCurrent(),
    ])
      .then(async ([tabs, settingsTab]) => {
        // A toolbar popup has no owning tab. A fallback settings tab does, but its URL
        // is withheld without the broad tabs permission; use its own opener instead.
        let target: unknown = settingsTab ? null : Array.isArray(tabs) ? tabs[0] : null;
        if (isRecord(settingsTab) && validTabId(settingsTab['openerTabId'])) {
          target = await browser.tabs.get(settingsTab['openerTabId']);
        }
        if (active) {
          const url = isRecord(target) && typeof target['url'] === 'string' ? target['url'] : '';
          setHostname(siteHostname(url));
          setTargetId(
            isRecord(target) && validTabId(target['id']) && isInjectableUrl(url)
              ? target['id']
              : null,
          );
        }
      })
      .catch(() => {
        if (active) {
          setHostname(null);
          setTargetId(null);
        }
      })
      .finally(() => {
        if (active) setTargetReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <PopupSettingsView
      settings={settings}
      interaction={interaction}
      colors={colors}
      position={position}
      width={width}
      hostname={hostname}
      searchUnavailable={
        !targetReady || !interaction.ready
          ? 'Loading page settings…'
          : targetId === null
            ? 'KeyMove is not available on this page.'
            : hostname &&
                Object.hasOwn(interaction.sites, hostname) &&
                interaction.sites[hostname] === 'paused'
              ? 'Paused on this site. Resume in Sites.'
              : null
      }
      onShowSearch={async () => {
        if (targetId === null) throw new Error('KeyMove is not available on this page.');
        let response: unknown;
        try {
          const tab: unknown = await browser.tabs.get(targetId);
          if (!isRecord(tab) || typeof tab['url'] !== 'string' || !isInjectableUrl(tab['url'])) {
            throw new Error('Unsupported page');
          }
          response = await browser.tabs.sendMessage(
            targetId,
            { type: ExtensionMessageTypes.SHOW_SEARCHBAR },
            { frameId: 0 },
          );
        } catch {
          throw new Error('Could not reach KeyMove on this page. Refresh the page and try again.');
        }
        if (isRecord(response) && Object.hasOwn(response, 'status')) {
          if (response['status'] === 'paused')
            throw new Error('Paused on this site. Resume in Sites.');
          if (response['status'] === 'loading')
            throw new Error('KeyMove is still loading. Try again.');
          if (response['status'] === 'shown') {
            await browser.tabs.update(targetId, { active: true });
            window.close();
            return;
          }
        }
        throw new Error('KeyMove could not open. Refresh the page and try again.');
      }}
    />
  );
}

function validTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
