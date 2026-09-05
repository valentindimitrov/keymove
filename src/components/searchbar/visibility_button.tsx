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
        id={'keymove-visibility-button'}
        className={'keymove-icon-button'}
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
          <div id={'keymove-visibility-tooltip'}>
            <div>{label}</div>
          </div>
        </Tooltip>
      )}
    </>
  );
};

export default VisibilityButton;
