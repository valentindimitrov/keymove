import Logo from '../../icons/logo-color.svg?react';
import { trusted } from '../../lib/trusted_input.js';

const SettingsButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    className="keymove-settings-button"
    aria-label="Open KeyMove settings"
    title="Settings"
    onMouseDown={event => event.preventDefault()}
    onClick={trusted(() => onClick())}
  >
    <Logo aria-hidden="true" />
  </button>
);

export default SettingsButton;
