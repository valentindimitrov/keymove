import FeedbackIcon from '../../../icons/mail.svg?react';
import SourceIcon from '../../../icons/source.svg?react';
import SupportIcon from '../../../icons/support.svg?react';
import DemoIcon from '../../../icons/demo.svg?react';
import SUPPORT_URL from '../../../support_url.js';
import InfoPanelButton from './info_panel_button.js';
import EXTENSION_IDENTITY from '../../../extension_identity.js';

const InfoPanelButtons = ({ compact = false }: { compact?: boolean }) => {
  return (
    <>
      <div className={'keymove-info-panel-button-row'}>
        <InfoPanelButton
          link={EXTENSION_IDENTITY.sourceUrl}
          icon={<SourceIcon aria-hidden="true" />}
          text={`${EXTENSION_IDENTITY.name} on GitHub`}
          compactText={compact ? 'GitHub' : undefined}
          openInNewTab
        />
      </div>
      <div className="keymove-info-panel-button-row">
        <InfoPanelButton
          link={EXTENSION_IDENTITY.demoUrl}
          icon={<DemoIcon aria-hidden="true" />}
          text={`${EXTENSION_IDENTITY.name} website`}
          compactText={compact ? 'Website' : undefined}
          openInNewTab
        />
      </div>
      <div className={'keymove-info-panel-button-row'}>
        <InfoPanelButton
          link={SUPPORT_URL}
          icon={<SupportIcon aria-hidden="true" />}
          text={`Leave a tip for ${EXTENSION_IDENTITY.name}`}
          compactText={compact ? 'Tip' : undefined}
          openInNewTab
        />
      </div>
      <div className={'keymove-info-panel-button-row'}>
        <InfoPanelButton
          link={EXTENSION_IDENTITY.contactUrl}
          icon={<FeedbackIcon aria-hidden="true" />}
          text={`Contact ${EXTENSION_IDENTITY.name} Developer`}
          compactText={compact ? 'Contact' : undefined}
        />
      </div>
    </>
  );
};

export default InfoPanelButtons;
