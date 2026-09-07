import React from 'react';
import InfoPanelRow from './info_panel_row.js';

type InfoPanelColorRowProps = {
  label: string;
  description: string;
  value: string;
  onChange: (color: string) => void;
};

const InfoPanelColorRow = (props: InfoPanelColorRowProps) => {
  const { label, description, value, onChange } = props;
  const inputId = React.useId();
  const descriptionId = `${inputId}-description`;

  return (
    <InfoPanelRow classes={'keymove-info-panel-setting-row'}>
      <input
        className={'keymove-info-panel-setting-color'}
        id={inputId}
        type="color"
        value={value}
        aria-describedby={descriptionId}
        onChange={event => onChange(event.target.value)}
      />
      <div className={'keymove-info-panel-setting-text'}>
        <label className={'keymove-info-panel-setting-header'} htmlFor={inputId}>
          {label}
        </label>
        <div id={descriptionId} className={'keymove-info-panel-setting-description'}>
          {description}
        </div>
      </div>
    </InfoPanelRow>
  );
};

export default InfoPanelColorRow;
