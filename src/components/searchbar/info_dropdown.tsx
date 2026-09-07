import React from 'react';
import { EXTENSION_NAME } from '../../extension_identity.js';
import useHover from '../../hooks/use_hover.js';
import InfoPanel from './info_panel/info_panel.js';
import Tooltip from './tooltip.js';
import HelpIcon from '../../icons/help.svg?react';

const InfoDropdown = () => {
  const containerRef = React.useRef<HTMLButtonElement>(null);
  const [hover, onMouseEnter, onMouseLeave] = useHover();
  const [isOpen, setIsOpen] = React.useState(false);
  const showInfoPanel = hover || isOpen;
  const dismiss = () => {
    onMouseLeave();
    setIsOpen(false);
    containerRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        id={'keymove-info-dropdown-button'}
        className={'keymove-icon-button'}
        ref={containerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            dismiss();
          }
        }}
        aria-label={`${EXTENSION_NAME} keyboard shortcuts`}
        aria-controls="keymove-info-panel"
        aria-expanded={showInfoPanel}
      >
        <HelpIcon />
      </button>
      {showInfoPanel && (
        <Tooltip containerRef={containerRef}>
          <InfoPanel onDismiss={dismiss} />
        </Tooltip>
      )}
    </>
  );
};

export default InfoDropdown;
