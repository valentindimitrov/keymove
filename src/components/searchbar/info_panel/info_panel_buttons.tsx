import FeedbackIcon from '../../../icons/feedback.svg?react';
import InfoPanelButton from './info_panel_button.js';
import EXTENSION_IDENTITY from '../../../extension_identity.js';

const InfoPanelButtons = () => {
  return (
    <div className={'keymove-info-panel-button-row'}>
      <InfoPanelButton
        link={EXTENSION_IDENTITY.contactUrl}
        icon={<FeedbackIcon />}
        text={`Contact ${EXTENSION_IDENTITY.name}`}
      />
    </div>
  );
};

export default InfoPanelButtons;
