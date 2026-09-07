import { LINK_OR_BUTTON_OR_INPUT_TYPES, LINK_OR_BUTTON_ROLE_VALUES } from '../constants.js';
import { searchableAttributesByNodeName } from './static_data.js';

function selectorsForNodeTypeWithSearchableAttributes(nodeName: string) {
  if (LINK_OR_BUTTON_OR_INPUT_TYPES.includes(nodeName)) {
    return nodeName.toLowerCase();
  } else {
    return LINK_OR_BUTTON_ROLE_VALUES.map(roleAttributeValue => {
      return `${nodeName.toLowerCase()}[role="${roleAttributeValue}"]`;
    }).join(', ');
  }
}

const ACTIONABLE_SELECTOR = Object.keys(searchableAttributesByNodeName)
  .map(nodeName => selectorsForNodeTypeWithSearchableAttributes(nodeName))
  .join(', ');

function isLinkOrButtonOrInput(node: Element) {
  return (
    LINK_OR_BUTTON_OR_INPUT_TYPES.includes(node.nodeName) ||
    LINK_OR_BUTTON_ROLE_VALUES.includes(node.getAttribute('role') || '')
  );
}

function searchableAttributeValuesForNode(node: Element) {
  const attributeNames = searchableAttributesByNodeName[node.nodeName] || [];
  return attributeNames.reduce<string[]>((values, attributeName) => {
    const attributeValue = node.getAttribute(attributeName);
    if (attributeValue) {
      values.push(attributeValue.toLocaleLowerCase());
    }
    return values;
  }, []);
}

export { ACTIONABLE_SELECTOR, isLinkOrButtonOrInput, searchableAttributeValuesForNode };
