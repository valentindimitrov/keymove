import { FIELD_BOOSTS, STARTS_WITH_BOOST, IS_VISIBLE_BOOST } from '../constants.js';

import Utils from './utils.js';

const WHITESPACE_SPLIT_REGEX = /[\s.,/\u200B-\u200D\uFEFF\u200E\u200F-]+/;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;

class NodeScorer {
  readonly queryText: string;

  constructor(searchText: string) {
    this.queryText = searchText;
  }

  textMatchesWithValue(innerText: string) {
    return innerText.includes(this.queryText);
  }

  score(node: Element, innerText: string, attributeValues: string[]) {
    let score = 0;

    innerText = innerText.replace(NO_BREAK_SPACE_REGEX, ' ');
    const innerTextWords = this.getWordsFromText(innerText);
    if (innerText) {
      score = this.fieldScore(innerText, innerTextWords, this.queryText, FIELD_BOOSTS.innerText);
    }

    if (attributeValues.length > 0) {
      const highestAttributeScore = this.getHighestAttributeScore(attributeValues, this.queryText);
      if (highestAttributeScore > score) {
        score = highestAttributeScore;
      }
    }

    if (score > 0 && Utils.nodeIsInViewport(node)) {
      score = score * IS_VISIBLE_BOOST;
    }

    return score;
  }

  fieldScore(fieldText: string, fieldWords: string[], queryText: string, fieldBoost = 1) {
    let score = 0;

    if (!fieldText) {
      return 0;
    }

    if (fieldText.includes(queryText)) {
      score += fieldBoost;
    }

    if (score > 0) {
      const queryWords = this.getWordsFromText(queryText);
      const hasWordStartingWithQueryText = fieldWords.some(word =>
        queryWords.some(qWord => word.startsWith(qWord)),
      );
      if (hasWordStartingWithQueryText) {
        score = score * STARTS_WITH_BOOST;
      }
    }

    return score;
  }

  getWordsFromText(text: string) {
    return text.split(WHITESPACE_SPLIT_REGEX);
  }

  getHighestAttributeScore(attributeTextValues: string[], queryText: string) {
    const attributeScores = attributeTextValues.map(attributeValue => {
      const attributeWords = this.getWordsFromText(attributeValue);
      return this.fieldScore(attributeValue, attributeWords, queryText, FIELD_BOOSTS.attribute);
    });
    return this.getHighestScore(attributeScores);
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
