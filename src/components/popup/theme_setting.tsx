import React from 'react';
import type { Theme } from '../../lib/stored_settings_schema.js';
import { validateStoredSetting } from '../../lib/stored_settings_schema.js';

type Props = { value: Theme; onChange: (value: Theme) => void };

export default function ThemeSetting({ value, onChange }: Props) {
  const id = React.useId();
  return (
    <div className="keymove-info-panel-row keymove-info-panel-setting-row keymove-theme-setting">
      <div className="keymove-info-panel-setting-text">
        <label className="keymove-info-panel-setting-header" htmlFor={id}>
          Appearance
        </label>
        <div id={`${id}-description`} className="keymove-info-panel-setting-description">
          System follows your device’s light or dark appearance.
        </div>
      </div>
      <select
        id={id}
        value={value}
        aria-describedby={`${id}-description`}
        onChange={event => {
          const result = validateStoredSetting('theme', event.target.value);
          if (!result.issues.length) onChange(result.value);
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
