import InfoPanelRow from './info_panel_row.js';
import type { KeyboardShortcut } from '../../../lib/static_data_schema.js';

type DisplayableKeyboardShortcut = KeyboardShortcut & {
  displayKeys: NonNullable<KeyboardShortcut['displayKeys']>;
  text: string;
};

type InfoPanelShortcutRowProps = { isMacOS: boolean; shortcut: DisplayableKeyboardShortcut };

const InfoPanelShortcutRow = (props: InfoPanelShortcutRowProps) => {
  const { isMacOS, shortcut } = props;

  const keys = (isMacOS && shortcut.displayKeys.mac) || shortcut.displayKeys.default;

  return (
    <InfoPanelRow>
      {keys.flatMap((key, index) => {
        const keyElement = (
          <div key={key} className={'keymove-info-panel-shortcut-key'}>
            {key}
          </div>
        );
        if (index === 0) {
          return [keyElement];
        }
        // Separators are decorative: assistive technology reads the keys in sequence.
        return [
          <div
            key={`separator-${key}`}
            className={'keymove-info-panel-shortcut-separator'}
            aria-hidden="true"
          >
            +
          </div>,
          keyElement,
        ];
      })}
      <div className={'keymove-info-panel-shortcut-text'}>{shortcut.text}</div>
    </InfoPanelRow>
  );
};

export default InfoPanelShortcutRow;
export type { DisplayableKeyboardShortcut };
