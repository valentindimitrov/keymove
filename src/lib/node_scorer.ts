import {
  FIELD_BOOSTS,
  SEARCH_TERM_BOOSTS,
  STARTS_WITH_BOOST,
  RELEVANT_WORD_BOOST,
  RELEVANT_SELECTOR_BOOST,
  IS_VISIBLE_BOOST,
} from '../constants.js';

import Utils from './utils.js';
import Synonyms from './synonyms.js';
import SearchableAttributeSettings from './searchable_attribute_settings.js';

const WHITESPACE_SPLIT_REGEX = /[(\s+)\-.,/\u200B-\u200D\uFEFF\u200E\u200F]+/;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;

class NodeScorer {
  readonly queryText: string;
  readonly synonyms: string[];
  readonly relevantWords: string[];
  readonly relevantSelectors: string[];
  readonly relevantWordToSelectorMappings: Record<string, string>;
  readonly searchableAttributeSettings: SearchableAttributeSettings;

  constructor(
    searchText: string,
    synonyms: Record<string, string[]>,
    relevantWords: string[],
    relevantSelectors: string[],
    relevantWordToSelectorMappings: Record<string, string>,
    searchableAttributeSettings: SearchableAttributeSettings,
  ) {
    this.queryText = searchText;
    this.synonyms = Synonyms.getSynonymsForTextFromSettings(searchText, synonyms);
    this.relevantWords = relevantWords;
    this.relevantSelectors = relevantSelectors;
    this.relevantWordToSelectorMappings = relevantWordToSelectorMappings;
    this.searchableAttributeSettings = searchableAttributeSettings;
  }

  scoreNode(node: Element) {
    const { innerText, attributeValues } = this.valuesForNode(node);
    return this.scoreNodeWithValues(node, innerText, attributeValues);
  }

  scoreNodeWithValues(node: Element, innerText: string, attributeValues: string[]) {
    return this.score(node, innerText, attributeValues);
  }

  nodeMatches(node: Element) {
    const { innerText, attributeValues } = this.valuesForNode(node);

    return this.nodeMatchesWithValues(node, innerText, attributeValues);
  }

  nodeMatchesWithValues(node: Element, innerText: string, attributeValues: string[]) {
    if (innerText && innerText.length > 0 && innerText.includes(this.queryText)) {
      return true;
    }

    if (
      attributeValues.length > 0 &&
      attributeValues.some(attributeValue => attributeValue.includes(this.queryText))
    ) {
      return true;
    }

    if (
      innerText &&
      innerText.length > 0 &&
      this.synonyms.some(synonym => innerText.includes(synonym))
    ) {
      return true;
    }

    if (
      attributeValues.length > 0 &&
      this.synonyms.some(synonym =>
        attributeValues.some(attributeValue => attributeValue.includes(synonym)),
      )
    ) {
      return true;
    }

    const wordWithSelectorMatchingQuery = Object.keys(this.relevantWordToSelectorMappings).find(
      word => word.startsWith(this.queryText),
    );
    if (
      wordWithSelectorMatchingQuery &&
      this.relevantWordToSelectorMappings[wordWithSelectorMatchingQuery] &&
      node.matches(this.relevantWordToSelectorMappings[wordWithSelectorMatchingQuery])
    ) {
      return true;
    }

    return false;
  }

  valuesForNode(node: Element) {
    return {
      innerText: Utils.getTextContentOfNode(node)
        .slice()
        .toLocaleLowerCase()
        .trim()
        .replace(NO_BREAK_SPACE_REGEX, ' '),
      attributeValues: this.searchableAttributeSettings.searchableAttributeValuesForNode(node),
    };
  }

  score(node: Element, innerText: string, attributeValues: string[]) {
    let score = 0;

    innerText = innerText.replace(NO_BREAK_SPACE_REGEX, ' ');
    const innerTextWords = this.getWordsFromText(innerText);
    if (innerText && innerText.length > 0) {
      score = this.fieldScore(
        innerText,
        innerTextWords,
        this.queryText,
        FIELD_BOOSTS.innerText,
        SEARCH_TERM_BOOSTS.searchText,
      );
    }

    if (attributeValues.length > 0) {
      const highestAttributeScore = this.getHighestAttributeScore(attributeValues, this.queryText);
      if (highestAttributeScore > score) {
        score = highestAttributeScore;
      }
    }

    if (score === 0 && this.synonyms.length > 0) {
      if (innerText && innerText.length > 0) {
        score = this.getHighestSynonymScore(innerText, innerTextWords);
      }

      if (attributeValues.length > 0) {
        const highestSynonymAttributePairScore =
          this.getHighestSynonymAttributePairScore(attributeValues);
        if (highestSynonymAttributePairScore > score) {
          score = highestSynonymAttributePairScore;
        }
      }
    }

    if (score === 0) {
      const wordWithSelectorMatchingQuery = Object.keys(this.relevantWordToSelectorMappings).find(
        word => word.startsWith(this.queryText),
      );
      if (
        wordWithSelectorMatchingQuery &&
        this.relevantWordToSelectorMappings[wordWithSelectorMatchingQuery] &&
        node.matches(this.relevantWordToSelectorMappings[wordWithSelectorMatchingQuery])
      ) {
        score = this.fieldScore(
          wordWithSelectorMatchingQuery,
          [wordWithSelectorMatchingQuery],
          this.queryText,
          FIELD_BOOSTS.innerText,
          SEARCH_TERM_BOOSTS.searchText,
        );
      }
    }

    if (score > 0) {
      if (this.relevantSelectors.some(selector => node.matches(selector))) {
        score = score * RELEVANT_SELECTOR_BOOST;
      }

      if (Utils.nodeIsInViewport(node)) {
        score = score * IS_VISIBLE_BOOST;
      }
    }

    return score;
  }

  fieldScore(
    fieldText: string,
    fieldWords: string[],
    queryText: string,
    fieldBoost = 1,
    queryTermBoost = 1,
  ) {
    let score = 0;

    if (!fieldText || fieldText.length === 0) {
      return 0;
    }

    if (fieldText.includes(queryText)) {
      score += fieldBoost * queryTermBoost;
    }

    if (score > 0) {
      const queryWords = this.getWordsFromText(queryText);
      const hasWordStartingWithQueryText = fieldWords.some(word =>
        queryWords.some(qWord => word.startsWith(qWord)),
      );
      if (hasWordStartingWithQueryText) {
        score = score * STARTS_WITH_BOOST;
      }

      const relevantWord = this.relevantWords.find(
        word => queryWords.some(qWord => word.includes(qWord)) && fieldWords.includes(word),
      );
      if (relevantWord) {
        score = score * RELEVANT_WORD_BOOST;
      }
    }

    return score;
  }

  getWordsFromText(text: string) {
    return text.split(WHITESPACE_SPLIT_REGEX);
  }

  getHighestAttributeScore(
    attributeTextValues: string[],
    queryText: string,
    queryIsSynonym = false,
  ) {
    const attributeScores = attributeTextValues.map(attributeValue => {
      const attributeWords = this.getWordsFromText(attributeValue);
      return this.fieldScore(
        attributeValue,
        attributeWords,
        queryText,
        FIELD_BOOSTS.attribute,
        queryIsSynonym ? SEARCH_TERM_BOOSTS.synonym : SEARCH_TERM_BOOSTS.searchText,
      );
    });
    return this.getHighestScore(attributeScores);
  }

  getHighestSynonymScore(innerText: string, innerTextWords: string[]) {
    const synonymScores = this.synonyms.map(synonym => {
      return this.fieldScore(
        innerText,
        innerTextWords,
        synonym,
        FIELD_BOOSTS.innerText,
        SEARCH_TERM_BOOSTS.synonym,
      );
    });
    return this.getHighestScore(synonymScores);
  }

  getHighestSynonymAttributePairScore(attributeTextValues: string[]) {
    const synonymScores = this.synonyms.map(synonym => {
      return this.getHighestAttributeScore(attributeTextValues, synonym, true);
    });
    return this.getHighestScore(synonymScores);
  }

  getHighestScore(scores: number[]) {
    return scores.sort(Utils.compareDescending)[0] ?? 0;
  }
}

export default NodeScorer;
