// The sandbox checkout is intentionally limited to development and test builds. Production
// builds replace import.meta.env.DEV with false, allowing the bundler to remove this URL.
const DEVELOPMENT_SUPPORT_URL = import.meta.env.DEV
  ? 'https://buy.stripe.com/test_cNieVe2GhbdMaeq6sd5os00'
  : null;

export default DEVELOPMENT_SUPPORT_URL;
