import InfoPanelKeyboardShortcuts from './info_panel_keyboard_shortcuts.js';
import InfoPanelButtons from './info_panel_buttons.js';
import InfoPanelSectionHeader from './info_panel_section_header.js';
import InfoPanelSettings from './info_panel_settings.js';
import type { SettingsControls } from '../settings_controls.js';

const InfoPanel = ({ onDismiss, ...settings }: SettingsControls & { onDismiss?: () => void }) => {
  return (
    <div
      id={'keymove-info-panel'}
      onKeyDown={event => {
        if (event.key === 'Escape' && onDismiss) {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <InfoPanelSectionHeader text={'Keyboard Shortcuts'} />
      <InfoPanelKeyboardShortcuts />
      <InfoPanelSectionHeader marginTop text={'Settings'} />
      <InfoPanelSettings {...settings} />
      <InfoPanelButtons />
    </div>
  );
};

export default InfoPanel;
