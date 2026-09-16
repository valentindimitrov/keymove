import { LINK_OR_BUTTON_ROLE_VALUES } from '../constants.js';
import { searchableAttributesByNodeName } from './static_data.js';
import { normalizeSearchText } from './search_text.js';

const ACTIONABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'label',
  'details > summary:first-of-type',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  ...LINK_OR_BUTTON_ROLE_VALUES.map(role => `[role="${role}"]`),
].join(', ');

// Styled checkboxes/radios often hide the native input and paint their visible UI
// in its label. Use the browser's association, never proximity or site classes.
function labelledToggle(node: Element): HTMLInputElement | null {
  if (!(node instanceof HTMLLabelElement) || node.closest('[aria-hidden="true"]')) return null;
  const control = node.control;
  return control instanceof HTMLInputElement && ['radio', 'checkbox'].includes(control.type)
    ? control
    : null;
}

function isLinkOrButtonOrInput(node: Element) {
  if (labelledToggle(node)) return true;
  if (['BUTTON', 'SELECT', 'TEXTAREA'].includes(node.nodeName)) return true;
  if (node.nodeName === 'INPUT') return node.getAttribute('type')?.toLowerCase() !== 'hidden';
  if (node.nodeName === 'A') return node.hasAttribute('href');
  if (node.nodeName === 'SUMMARY')
    return (
      node.parentElement?.nodeName === 'DETAILS' &&
      node.parentElement.querySelector('summary') === node
    );
  const editable = node.getAttribute('contenteditable');
  return (
    (editable !== null && ['', 'true', 'plaintext-only'].includes(editable.toLowerCase())) ||
    LINK_OR_BUTTON_ROLE_VALUES.includes(node.getAttribute('role') ?? '')
  );
}

function isActionDisabled(node: Element) {
  if (node instanceof HTMLLabelElement) {
    const control = labelledToggle(node);
    if (control ? isActionDisabled(control) : !isLinkOrButtonOrInput(node)) return true;
  }
  return node.matches(':disabled') || Boolean(node.closest('[aria-disabled="true"], [inert]'));
}

function searchableAttributeValuesForNode(node: Element) {
  const attributeNames = searchableAttributesByNodeName[node.nodeName] || [];
  return attributeNames.reduce<string[]>((values, attributeName) => {
    const attributeValue = node.getAttribute(attributeName);
    if (attributeValue) {
      values.push(normalizeSearchText(attributeValue));
    }
    return values;
  }, []);
}

export {
  labelledToggle,
  ACTIONABLE_SELECTOR,
  isLinkOrButtonOrInput,
  isActionDisabled,
  searchableAttributeValuesForNode,
};
