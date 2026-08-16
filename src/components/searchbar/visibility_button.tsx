import React from 'react';
import useHover from '../../hooks/use_hover.js';
import Tooltip from './tooltip.js';
import ShowIcon from '../../icons/show.svg?react';
import HideIcon from '../../icons/hide.svg?react';

type VisibilityButtonProps = { autoHide: boolean; toggleAutoHide: () => void };

const VisibilityButton = (props: VisibilityButtonProps) => {
  const { autoHide, toggleAutoHide } = props;
  const containerRef = React.useRef<HTMLButtonElement>(null);
  const [hover, onMouseEnter, onMouseLeave] = useHover();
  const [focused, setFocused] = React.useState(false);
  const label = autoHide ? 'Turn Autohide off' : 'Turn Autohide on';

  return (
    <>
      <button
        type="button"
        id={'yipyip-visibility-button'}
        className={'yipyip-icon-button'}
        ref={containerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={toggleAutoHide}
        aria-label={label}
      >
        {autoHide ? <ShowIcon /> : <HideIcon />}
      </button>
      {(hover || focused) && (
        <Tooltip containerRef={containerRef}>
          <div id={'yipyip-visibility-tooltip'}>
            <div>{label}</div>
            <div id={'yipyip-visibility-tooltip-keyboard-shortcuts'}>
              <div className={'yipyip-info-panel-shortcut-key'}>Option</div>
              <div className={'yipyip-info-panel-shortcut-key'}>Escape</div>
            </div>
          </div>
        </Tooltip>
      )}
    </>
  );
};

export default VisibilityButton;
