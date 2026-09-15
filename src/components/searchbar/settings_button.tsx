import Logo from '../../icons/logo-color.svg?react';

const SettingsButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    className="keymove-settings-button"
    aria-label="Open KeyMove settings"
    title="Settings"
    onMouseDown={event => event.preventDefault()}
    onClick={onClick}
  >
    <Logo aria-hidden="true" />
  </button>
);

export default SettingsButton;
