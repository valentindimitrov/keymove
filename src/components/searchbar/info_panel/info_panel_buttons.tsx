import FeedbackIcon from '../../../icons/feedback.svg?react';
import SourceIcon from '../../../icons/source.svg?react';
import SupportIcon from '../../../icons/support.svg?react';
import DEVELOPMENT_SUPPORT_URL from '../../../development_support_url.js';
import InfoPanelButton from './info_panel_button.js';
import EXTENSION_IDENTITY from '../../../extension_identity.js';

const InfoPanelButtons = ({ compact = false }: { compact?: boolean }) => {
  return (
    <>
      <div className={'keymove-info-panel-button-row'}>
        <InfoPanelButton
          link={EXTENSION_IDENTITY.sourceUrl}
          icon={<SourceIcon />}
          text={`${EXTENSION_IDENTITY.name} on GitHub`}
          compactText={compact ? 'GitHub' : undefined}
        />
      </div>
      {DEVELOPMENT_SUPPORT_URL && (
        <div className={'keymove-info-panel-button-row'}>
          <InfoPanelButton
            link={DEVELOPMENT_SUPPORT_URL}
            icon={<SupportIcon />}
            text={`Support ${EXTENSION_IDENTITY.name}`}
            compactText={compact ? 'Support' : undefined}
            openInNewTab
          />
        </div>
      )}
      <div className={'keymove-info-panel-button-row'}>
        <InfoPanelButton
          link={EXTENSION_IDENTITY.contactUrl}
          icon={<FeedbackIcon />}
          text={`Contact ${EXTENSION_IDENTITY.name} Developer`}
          compactText={compact ? 'Contact' : undefined}
        />
      </div>
    </>
  );
};

export default InfoPanelButtons;
