import InfoPanelSettingRow from './info_panel_setting_row.js';
import { EXTENSION_NAME } from '../../../extension_identity.js';
import type { SettingsControls } from '../settings_controls.js';

const InfoPanelSettings = (props: SettingsControls) => {
  const {
    autoHide,
    toggleAutoHide,
    useOnEveryWebsite,
    toggleUseOnEveryWebsite,
    alwaysOn,
    toggleAlwaysOn,
    resetPopupPosition,
  } = props;

  const settings = [
    {
      label: 'Use on all websites (Experimental)',
      description: `${EXTENSION_NAME} is currently optimized for Gmail and may be buggy on other websites.`,
      value: useOnEveryWebsite,
      onChange: toggleUseOnEveryWebsite,
    },
    {
      label: 'Always on',
      description: `Focus the ${EXTENSION_NAME} searchbar anytime you press any key if another input is not focused.`,
      value: alwaysOn,
      onChange: toggleAlwaysOn,
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
