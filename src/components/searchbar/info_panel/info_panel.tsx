import InfoPanelKeyboardShortcuts from './info_panel_keyboard_shortcuts.js';
import InfoPanelSectionHeader from './info_panel_section_header.js';

// Settings and the contact link live in the toolbar popup. This panel is shortcuts only.
const InfoPanel = ({ onDismiss }: { onDismiss?: () => void }) => {
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
    </div>
  );
};

export default InfoPanel;
