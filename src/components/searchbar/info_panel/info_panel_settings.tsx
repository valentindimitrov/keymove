import InfoPanelSettingRow from './info_panel_setting_row.js';
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
