import { EXTENSION_NAME } from '../../extension_identity.js';

const TemporarilyEnabledMessage = () => {
  return (
    <div id={'keymove-temporarily-enabled-message'}>
      You have {EXTENSION_NAME} turned off on this page.
      <br />
      Turn it on here by clicking "Use on every Website".
    </div>
  );
};

export default TemporarilyEnabledMessage;
