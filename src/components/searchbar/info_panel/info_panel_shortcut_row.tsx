import React from 'react';
import InfoPanelRow from './info_panel_row.js';
import type { KeyboardShortcut } from '../../../lib/static_data_schema.js';

type DisplayableKeyboardShortcut = KeyboardShortcut & {
  displayKeys: NonNullable<KeyboardShortcut['displayKeys']>;
  text: string;
};

type InfoPanelShortcutRowProps = { isMacOS: boolean; shortcut: DisplayableKeyboardShortcut };

const InfoPanelShortcutRow = (props: InfoPanelShortcutRowProps) => {
  const { isMacOS, shortcut } = props;

  const keys = React.useMemo(() => {
    return (isMacOS && shortcut.displayKeys.mac) || shortcut.displayKeys.default;
  }, [shortcut, isMacOS]);

  return (
    <InfoPanelRow>
      {keys.map(key => {
        return (
          <div key={key} className={'keymove-info-panel-shortcut-key'}>
            {key}
          </div>
        );
      })}
      <div className={'keymove-info-panel-shortcut-text'}>{shortcut.text}</div>
    </InfoPanelRow>
  );
};

export default InfoPanelShortcutRow;
export type { DisplayableKeyboardShortcut };
