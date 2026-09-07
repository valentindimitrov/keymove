const EXTENSION_NAME = 'KeyMove';
const CONTACT_EMAIL = 'keymove.impulse550@passmail.com';

const EXTENSION_IDENTITY = {
  name: EXTENSION_NAME,
  shortName: EXTENSION_NAME,
  description: 'Never touch your mouse again!',
  toolbarTitle: `Search with ${EXTENSION_NAME}!`,
  artifactName: 'keymove',
  contactEmail: CONTACT_EMAIL,
  contactUrl: `mailto:${CONTACT_EMAIL}`,
  sourceUrl: 'https://github.com/valentindimitrov/keymove',
} as const;

export { CONTACT_EMAIL, EXTENSION_NAME };
export default EXTENSION_IDENTITY;
