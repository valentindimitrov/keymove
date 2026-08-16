import InfoPanelRow from './info_panel_row.js';

type InfoPanelSettingRowProps = {
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
};

const InfoPanelSettingRow = (props: InfoPanelSettingRowProps) => {
  const { label, description, value, onChange } = props;

  return (
    <InfoPanelRow classes={'yipyip-info-panel-setting-row'}>
      <input
        className={'yipyip-info-panel-setting-checkbox'}
        type="checkbox"
        value={value ? '1' : '0'}
        checked={value}
        name={description}
        onChange={onChange}
      />
      <div className={'yipyip-info-panel-setting-text'}>
        <div className={'yipyip-info-panel-setting-header'}>{label}</div>
        <div className={'yipyip-info-panel-setting-description'}>{description}</div>
      </div>
    </InfoPanelRow>
  );
};

export default InfoPanelSettingRow;
