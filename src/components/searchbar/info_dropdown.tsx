import React from 'react';
import useHover from '../../hooks/use_hover.js';
import InfoPanel from './info_panel/info_panel.js';
import Tooltip from './tooltip.js';
import HelpIcon from '../../icons/help.svg?react';
import TemporarilyEnabledMessage from './temporarily_enabled_message.js';
import type { SettingsControls } from './settings_controls.js';

type InfoDropdownProps = SettingsControls & { temporarilyEnabled: boolean };

const InfoDropdown = (props: InfoDropdownProps) => {
  const {
    autoHide,
    toggleAutoHide,
    useOnEveryWebsite,
    toggleUseOnEveryWebsite,
    temporarilyEnabled,
    alwaysOn,
    toggleAlwaysOn,
  } = props;

  const containerRef = React.useRef<HTMLButtonElement>(null);
  const [hover, onMouseEnter, onMouseLeave] = useHover();
  const [isOpen, setIsOpen] = React.useState(false);
  const showInfoPanel = hover || isOpen;

  let tooltipContents: React.ReactNode;
  if (showInfoPanel) {
    tooltipContents = (
      <InfoPanel
        autoHide={autoHide}
        toggleAutoHide={toggleAutoHide}
        useOnEveryWebsite={useOnEveryWebsite}
        toggleUseOnEveryWebsite={toggleUseOnEveryWebsite}
        alwaysOn={alwaysOn}
        toggleAlwaysOn={toggleAlwaysOn}
      />
    );
  } else if (temporarilyEnabled) {
    tooltipContents = <TemporarilyEnabledMessage />;
  }

  return (
    <>
      <button
        type="button"
        id={'yipyip-info-dropdown-button'}
        className={'yipyip-icon-button'}
        ref={containerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setIsOpen(false);
          }
        }}
        aria-label="YipYip help and settings"
        aria-controls="yipyip-info-panel"
        aria-expanded={showInfoPanel}
      >
        <HelpIcon />
      </button>
      {tooltipContents && (
        <Tooltip
          containerRef={containerRef}
          key={showInfoPanel ? 'info-panel' : 'temporarily-enabled'}
        >
          {tooltipContents}
        </Tooltip>
      )}
    </>
  );
};

export default InfoDropdown;
