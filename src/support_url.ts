import EXTENSION_IDENTITY from './extension_identity.js';

// Vite replaces import.meta.env.DEV at build time and removes the sandbox branch from
// production. Keep the test destination out of the shared identity object so it cannot leak.
const SUPPORT_URL = import.meta.env.DEV
  ? 'https://buy.stripe.com/test_cNieVe2GhbdMaeq6sd5os00'
  : EXTENSION_IDENTITY.supportUrl;

export default SUPPORT_URL;
