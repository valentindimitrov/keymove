import React from 'react';
import { keyboardShortcuts } from '../../../lib/static_data.js';
import Utils from '../../../lib/utils.js';
import InfoPanelShortcutRow from './info_panel_shortcut_row.js';
import type { DisplayableKeyboardShortcut } from './info_panel_shortcut_row.js';

const InfoPanelKeyboardShortcuts = () => {
  const isMacOS = React.useMemo(() => Utils.isMacOS(), []);

  return (
    <>
      {keyboardShortcuts
        .filter((shortcut): shortcut is DisplayableKeyboardShortcut =>
          Boolean(shortcut.text && shortcut.displayKeys),
        )
        .map(shortcut => {
          return <InfoPanelShortcutRow key={shortcut.text} isMacOS={isMacOS} shortcut={shortcut} />;
        })}
    </>
  );
};

export default InfoPanelKeyboardShortcuts;
