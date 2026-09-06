import { LINK_OR_BUTTON_OR_INPUT_TYPES, LINK_OR_BUTTON_ROLE_VALUES } from '../constants.js';
import { searchableAttributesByNodeName as defaultSearchableAttributesByNodeName } from './static_data.js';

const defaultButtonOrLinkQuerySelectors = Object.keys(defaultSearchableAttributesByNodeName).map(
  nodeName => selectorsForNodeTypeWithSearchableAttributes(nodeName),
);

function selectorsForNodeTypeWithSearchableAttributes(nodeName: string) {
  if (LINK_OR_BUTTON_OR_INPUT_TYPES.includes(nodeName)) {
    return nodeName.toLowerCase();
  } else {
    return LINK_OR_BUTTON_ROLE_VALUES.map(roleAttributeValue => {
      return `${nodeName.toLowerCase()}[role="${roleAttributeValue}"]`;
    }).join(', ');
  }
}

class SearchableAttributeSettings {
  readonly additionalButtonSelectors: string[];
  readonly additionalSearchableAttributesByNodeName: Record<string, string[]>;

  constructor(
    appSpecificAdditionalButtonSelectors: string[] = [],
    appSpecificAdditionalSearchableAttributesByNodeName: Record<string, string[]> = {},
  ) {
    this.additionalButtonSelectors = appSpecificAdditionalButtonSelectors;
    this.additionalSearchableAttributesByNodeName =
      appSpecificAdditionalSearchableAttributesByNodeName;
  }

  searchableAttributeSettingsByNodeNameToQuerySelector() {
    return [...defaultButtonOrLinkQuerySelectors, ...this.additionalButtonSelectors].join(', ');
  }

  isLinkOrButtonOrInput(node: Element) {
    return (
      LINK_OR_BUTTON_OR_INPUT_TYPES.includes(node.nodeName) ||
      LINK_OR_BUTTON_ROLE_VALUES.includes(node.getAttribute('role') || '') ||
      this.additionalButtonSelectors.some(selector => node.matches(selector))
    );
  }

  searchableAttributeValuesForNode(node: Element) {
    const searchableAttributesForNode = this.searchableAttributesForNode(node);
    return this.lowercaseAttributeValuesForAttributesOfNode(node, searchableAttributesForNode);
  }

  searchableAttributesForNode(node: Element) {
    return [
      ...(defaultSearchableAttributesByNodeName[node.nodeName] || []),
      ...(this.additionalSearchableAttributesByNodeName[node.nodeName] || []),
    ];
  }

  lowercaseAttributeValuesForAttributesOfNode(node: Element, attributeNames: string[]) {
    return attributeNames.reduce<string[]>((arr, attributeName) => {
      const attributeValue = node.getAttribute(attributeName);
      if (attributeValue) {
        arr.push(attributeValue.toLowerCase());
      }
      return arr;
    }, []);
  }
}

export default SearchableAttributeSettings;
