import React from 'react';
import InfoPanelRow from './info_panel_row.js';

type InfoPanelSettingRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onChange: () => void;
};

const InfoPanelSettingRow = (props: InfoPanelSettingRowProps) => {
  const { label, description, value, onChange } = props;
  const inputId = React.useId();
  const descriptionId = `${inputId}-description`;

  return (
    <InfoPanelRow classes={'keymove-info-panel-setting-row'}>
      <input
        className={'keymove-info-panel-setting-checkbox'}
        id={inputId}
        type="checkbox"
        value={value ? '1' : '0'}
        checked={value}
        aria-describedby={description ? descriptionId : undefined}
        onChange={onChange}
      />
      <div className={'keymove-info-panel-setting-text'}>
        <label className={'keymove-info-panel-setting-header'} htmlFor={inputId}>
          {label}
        </label>
        {description && (
          <div id={descriptionId} className={'keymove-info-panel-setting-description'}>
            {description}
          </div>
        )}
      </div>
    </InfoPanelRow>
  );
};

export default InfoPanelSettingRow;
