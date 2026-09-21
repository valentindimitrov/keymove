import React from 'react';
import {
  DEFAULT_OPENING_SHORTCUT,
  openingShortcutIssue,
  openingShortcutKeys,
} from '../../lib/interaction_settings_schema.js';
import type { OpeningShortcut } from '../../lib/interaction_settings_schema.js';
import Utils from '../../lib/utils.js';
export default function OpeningShortcutSetting({
  value,
  onChange,
  disabled,
}: {
  value: OpeningShortcut;
  onChange: (value: OpeningShortcut) => void;
  disabled: boolean;
}) {
  const id = React.useId();
  const [issue, setIssue] = React.useState<string | null>(null);
  return (
    <>
      <label className="keymove-settings-field" htmlFor={id}>
        <span>
          Open KeyMove
          <span className="keymove-info-panel-setting-description" id={`${id}-hint`}>
            Focus the field and press a shortcut.
          </span>
        </span>
        <input
          id={id}
          aria-label="Open KeyMove"
          type="text"
          readOnly
          disabled={disabled}
          value={openingShortcutKeys(value, Utils.isMacOS()).join('+')}
          aria-describedby={`${id}-hint ${id}-warning`}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.key === 'Tab' || event.key === 'Escape')
              return;
            event.preventDefault();
            event.stopPropagation();
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
            const next = {
              code: event.code,
              altKey: event.altKey,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              shiftKey: event.shiftKey,
            };
            const error = event.getModifierState('AltGraph')
              ? 'AltGr is reserved for typing characters.'
              : openingShortcutIssue(next);
            setIssue(error);
            if (!error) onChange(next);
          }}
        />
      </label>
      {issue && <p role="alert">{issue}</p>}
      <p id={`${id}-warning`} className="keymove-popup-hint">
        Browser or system shortcuts may not reach KeyMove.
      </p>
      <button
        type="button"
        className="keymove-settings-button"
        disabled={disabled}
        onClick={() => {
          setIssue(null);
          onChange(DEFAULT_OPENING_SHORTCUT);
        }}
      >
        Restore opening shortcut
      </button>
    </>
  );
}
