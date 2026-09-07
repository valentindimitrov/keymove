import InfoPanelSettingRow from './info_panel_setting_row.js';
import InfoPanelColorRow from './info_panel_color_row.js';
import { SEARCH_MODES } from '../../../hooks/use_search_navigation.js';
import { EXTENSION_NAME } from '../../../extension_identity.js';
import type { SettingsControls } from '../settings_controls.js';

const InfoPanelSettings = (props: SettingsControls) => {
  const {
    autoHide,
    toggleAutoHide,
    alwaysOn,
    toggleAlwaysOn,
    startInActionMode,
    toggleStartInActionMode,
    highlightMatches,
    toggleHighlightMatches,
    showAutohideButton,
    toggleShowAutohideButton,
    highlightColors,
    updateHighlightColor,
    resetHighlightColors,
    resetPopupPosition,
  } = props;

  const settings = [
    {
      label: 'Always on',
      description: `Focus the ${EXTENSION_NAME} searchbar anytime you press any key if another input is not focused.`,
      value: alwaysOn,
      onChange: toggleAlwaysOn,
    },
    {
      label: 'Start in action mode',
      description: 'Begin each search in action mode instead of text mode.',
      value: startInActionMode,
      onChange: toggleStartInActionMode,
    },
    {
      label: 'Highlight matches',
      description: 'Tint matching text on the page, and mark the current one.',
      value: highlightMatches,
      onChange: toggleHighlightMatches,
    },
    {
      label: 'Show autohide button',
      description: 'Show the eye icon that turns Autohide on and off from the searchbar.',
      value: showAutohideButton,
      onChange: toggleShowAutohideButton,
    },
    {
      label: 'Autohide',
      description: `Hide the ${EXTENSION_NAME} searchbar when not searching.`,
      value: autoHide,
      onChange: toggleAutoHide,
    },
  ];

  return (
    <>
      {settings.map(setting => {
        return <InfoPanelSettingRow key={setting.label} {...setting} />;
      })}
      <InfoPanelColorRow
        label={'Text highlight colour'}
        description={'Colour for matching text and its outline.'}
        value={highlightColors[SEARCH_MODES.TEXT]}
        onChange={color => updateHighlightColor(SEARCH_MODES.TEXT, color)}
      />
      <InfoPanelColorRow
        label={'Action highlight colour'}
        description={'Colour for the outline around matching buttons and links.'}
        value={highlightColors[SEARCH_MODES.ACTIONS]}
        onChange={color => updateHighlightColor(SEARCH_MODES.ACTIONS, color)}
      />
      <button
        type="button"
        className="keymove-info-panel-reset-position-button"
        onClick={resetHighlightColors}
      >
        Reset highlight colours
      </button>
      <button
        type="button"
        className="keymove-info-panel-reset-position-button"
        onClick={resetPopupPosition}
      >
        Reset popup position
      </button>
    </>
  );
};

export default InfoPanelSettings;
