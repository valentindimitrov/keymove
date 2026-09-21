import React from 'react';
import { keyboardShortcuts } from '../../../lib/static_data.js';
import Utils from '../../../lib/utils.js';
import InfoPanelShortcutRow from './info_panel_shortcut_row.js';
import type { DisplayableKeyboardShortcut } from './info_panel_shortcut_row.js';
import {
  DEFAULT_OPENING_SHORTCUT,
  openingShortcutKeys,
} from '../../../lib/interaction_settings_schema.js';
import type { OpeningShortcut } from '../../../lib/interaction_settings_schema.js';

const InfoPanelKeyboardShortcuts = ({
  openingShortcut = DEFAULT_OPENING_SHORTCUT,
  omitOpening = false,
}: {
  openingShortcut?: OpeningShortcut | undefined;
  omitOpening?: boolean;
}) => {
  const isMacOS = React.useMemo(() => Utils.isMacOS(), []);

  return (
    <>
      {keyboardShortcuts
        .filter((shortcut): shortcut is DisplayableKeyboardShortcut =>
          Boolean(shortcut.text && shortcut.displayKeys),
        )
        .map(shortcut => {
          if (shortcut.name === 'focus_searchbar') {
            if (omitOpening) return null;
            shortcut = {
              ...shortcut,
              displayKeys: { default: openingShortcutKeys(openingShortcut, isMacOS) },
            };
          }
          return <InfoPanelShortcutRow key={shortcut.text} isMacOS={isMacOS} shortcut={shortcut} />;
        })}
    </>
  );
};

export default InfoPanelKeyboardShortcuts;
