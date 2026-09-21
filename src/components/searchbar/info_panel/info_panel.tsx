import InfoPanelKeyboardShortcuts from './info_panel_keyboard_shortcuts.js';
import InfoPanelSectionHeader from './info_panel_section_header.js';
import type { OpeningShortcut } from '../../../lib/interaction_settings_schema.js';

// Settings and the contact link live in the toolbar popup. This panel is shortcuts only.
const InfoPanel = ({
  onDismiss,
  openingShortcut,
}: {
  onDismiss?: () => void;
  openingShortcut?: OpeningShortcut | undefined;
}) => {
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
      <InfoPanelKeyboardShortcuts openingShortcut={openingShortcut} />
    </div>
  );
};

export default InfoPanel;
