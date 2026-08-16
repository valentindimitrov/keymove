import AppSpecificSettings from './app_specific_settings.js';
import Synonyms from './synonyms.js';
import NodeScorer from './node_scorer.js';
import { PageSearchIndex } from './page_search_index.js';
import SearchableAttributeSettings from './searchable_attribute_settings.js';

let sharedIndex = null;
let sharedIndexHost = null;

class FindInPage {
  constructor(searchText) {
    this.searchText = searchText.toLocaleLowerCase().trimStart();
    const host = window.location.host;
    const appSpecificSettings = AppSpecificSettings.getSettingsForHost(host);
    const synonyms = Synonyms.mergeMutualSynonymsIntoDirected(appSpecificSettings.synonyms || {});
    const relevantWords = appSpecificSettings.relevant_words || [];
    const relevantWordToSelectorMappings =
      appSpecificSettings.relevant_word_to_selector_mappings || {};

    const relevantSelectors = (appSpecificSettings.relevant_selectors || []).map(
      selectorData => selectorData.selector,
    );

    const additionalButtonSelectors = (appSpecificSettings.additional_button_selectors || []).map(
      selectorData => selectorData.selector,
    );

    const additionalSearchableAttributesByNodeName =
      appSpecificSettings.additional_searchable_attributes_by_node_name || {};

    this.searchableAttributeSettings = new SearchableAttributeSettings(
      additionalButtonSelectors,
      additionalSearchableAttributesByNodeName,
    );
    this.nodeScorer = new NodeScorer(
      this.searchText,
      synonyms,
      relevantWords,
      relevantSelectors,
      relevantWordToSelectorMappings,
      this.searchableAttributeSettings,
    );

    if (!sharedIndex || sharedIndexHost !== host) {
      if (sharedIndex) {
        sharedIndex.disconnect();
      }

      sharedIndexHost = host;
      sharedIndex = new PageSearchIndex(
        this.searchableAttributeSettings,
        Object.values(relevantWordToSelectorMappings),
      );
    }
  }

  findMatches(options = {}) {
    if (this.searchText.length < 2) {
      return Promise.resolve({
        matchingNodes: [],
        matchingLinksAndButtons: [],
        bestMatchingLinkOrButtonIndex: null,
      });
    }

    return sharedIndex.search(this.nodeScorer, options);
  }
}

function resetSearchIndex() {
  if (sharedIndex) {
    sharedIndex.disconnect();
  }
  sharedIndex = null;
  sharedIndexHost = null;
}

export { resetSearchIndex };
export default FindInPage;
