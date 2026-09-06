import { EXTENSION_NAME } from '../../extension_identity.js';

const TemporarilyEnabledMessage = () => {
  return (
    <div id={'keymove-temporarily-enabled-message'}>
      You have {EXTENSION_NAME} turned off on this page.
      <br />
      Keep it on by enabling "Use on all websites (Experimental)" in settings.
    </div>
  );
};

export default TemporarilyEnabledMessage;
