import InfoPanelKeyboardShortcuts from './info_panel_keyboard_shortcuts.js';
import InfoPanelButtons from './info_panel_buttons.js';
import InfoPanelSectionHeader from './info_panel_section_header.js';
import InfoPanelSettings from './info_panel_settings.js';

import { COMAKE_LANDING_PAGE_LINK } from '../../../constants.js';
import type { SettingsControls } from '../settings_controls.js';

const InfoPanel = ({ onDismiss, ...settings }: SettingsControls & { onDismiss?: () => void }) => {
  const madeWithLoveHeader = (
    <>
      Made with ❤️ by{' '}
      <a
        id={'keymove-comake-link'}
        href={COMAKE_LANDING_PAGE_LINK}
        target="_blank"
        rel="noreferrer"
      >
        COMAKE
      </a>
    </>
  );

  return (
    <div id={'keymove-info-panel'} onKeyDown={event => {
      if (event.key === 'Escape' && onDismiss) {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }
    }}>
      <InfoPanelSectionHeader text={'Keyboard Shortcuts'} />
      <InfoPanelKeyboardShortcuts />
      <InfoPanelSectionHeader marginTop text={'Settings'} />
      <InfoPanelSettings {...settings} />
      <InfoPanelSectionHeader marginTop text={madeWithLoveHeader} />
      <InfoPanelButtons />
    </div>
  );
};

export default InfoPanel;
