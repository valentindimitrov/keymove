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

const WHITESPACE_SPLIT_REGEX = /[\s.,/\u200B-\u200D\uFEFF\u200E\u200F-]+/;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;

class NodeScorer {
  readonly queryText: string;
  readonly synonyms: string[];
  readonly relevantWords: string[];
  readonly relevantSelectors: string[];
  readonly relevantWordToSelectorMappings: Record<string, string>;

  constructor(
    searchText: string,
    synonyms: Record<string, string[]>,
    relevantWords: string[],
    relevantSelectors: string[],
    relevantWordToSelectorMappings: Record<string, string>,
  ) {
    this.queryText = searchText;
    this.synonyms = Synonyms.getSynonymsForTextFromSettings(searchText, synonyms);
    this.relevantWords = relevantWords;
    this.relevantSelectors = relevantSelectors;
    this.relevantWordToSelectorMappings = relevantWordToSelectorMappings;
  }

  textMatchesWithValue(innerText: string) {
    return (
      innerText.includes(this.queryText) ||
      this.synonyms.some(synonym => innerText.includes(synonym))
    );
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
    let highestScore = scores[0] ?? 0;
    for (let index = 1; index < scores.length; index += 1) {
      highestScore = Math.max(highestScore, scores[index]!);
    }
    return highestScore;
  }
}

export default NodeScorer;
