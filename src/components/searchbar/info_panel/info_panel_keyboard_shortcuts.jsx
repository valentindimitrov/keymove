import React from 'react';
import { keyboardShortcuts } from '../../../lib/static_data.js';
import Utils from '../../../lib/utils.js';
import InfoPanelShortcutRow from './info_panel_shortcut_row.jsx';

const InfoPanelKeyboardShortcuts = () => {
  const isMacOS = React.useMemo(() => Utils.isMacOS(), []);

  return (
    <>
      {keyboardShortcuts
        .filter(shortcut => shortcut.text && shortcut.displayKeys)
        .map(shortcut => {
          return <InfoPanelShortcutRow key={shortcut.text} isMacOS={isMacOS} shortcut={shortcut} />;
        })}
    </>
  );
};

export default InfoPanelKeyboardShortcuts;
