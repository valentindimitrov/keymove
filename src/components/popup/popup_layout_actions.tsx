import InfoPanelSettingRow from '../searchbar/info_panel/info_panel_setting_row.js';

type PopupLayoutActionsProps = {
  locked: boolean;
  onToggleLock: () => void;
  onReset: () => void;
};

const PopupLayoutActions = ({ locked, onToggleLock, onReset }: PopupLayoutActionsProps) => (
  <div className="keymove-popup-layout-actions">
    <InfoPanelSettingRow label="Lock position and size" value={locked} onChange={onToggleLock} />
    <button
      type="button"
      className="keymove-info-panel-reset-position-button"
      disabled={locked}
      onClick={onReset}
    >
      Reset position and size
    </button>
  </div>
);

export default PopupLayoutActions;
