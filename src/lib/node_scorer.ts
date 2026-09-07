import {
  FIELD_BOOSTS,
  STARTS_WITH_BOOST,
  IS_VISIBLE_BOOST,
  FUZZY_DISTANCE_PENALTY,
} from '../constants.js';

import Utils from './utils.js';
import { fuzzyMatchInText, maxDistanceForQuery } from './fuzzy_match.js';

const WHITESPACE_SPLIT_REGEX = /[\s.,/\u200B-\u200D\uFEFF\u200E\u200F-]+/;
const NO_BREAK_SPACE_REGEX = /\u00a0/g;

type ScoredMatch = { score: number; textTerm: string | null; distance: number | null };

class NodeScorer {
  readonly queryText: string;
  readonly maxFuzzyDistance: number;

  constructor(searchText: string) {
    this.queryText = searchText;
    this.maxFuzzyDistance = maxDistanceForQuery(searchText);
  }

  supportsFuzzy() {
    return this.maxFuzzyDistance > 0;
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

  /**
   * Scores a node by closeness rather than containment, for use only when an exact pass
   * found nothing. Each edit costs a constant factor, so nearer spellings outrank further
   * ones and every fuzzy result still ranks below any exact one.
   */
  fuzzyScore(node: Element, innerText: string, attributeValues: string[]): ScoredMatch {
    const textMatch = innerText
      ? fuzzyMatchInText(innerText, this.queryText, this.maxFuzzyDistance)
      : null;
    let score = textMatch
      ? FIELD_BOOSTS.innerText * FUZZY_DISTANCE_PENALTY ** textMatch.distance
      : 0;

    for (const attributeValue of attributeValues) {
      const attributeMatch = fuzzyMatchInText(
        attributeValue,
        this.queryText,
        this.maxFuzzyDistance,
      );
      if (!attributeMatch) continue;
      const attributeScore =
        FIELD_BOOSTS.attribute * FUZZY_DISTANCE_PENALTY ** attributeMatch.distance;
      if (attributeScore > score) score = attributeScore;
    }

    if (score > 0 && Utils.nodeIsInViewport(node)) {
      score = score * IS_VISIBLE_BOOST;
    }

    return { score, textTerm: textMatch?.term ?? null, distance: textMatch?.distance ?? null };
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

export type { ScoredMatch };
export default NodeScorer;
