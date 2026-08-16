import type { SynonymSettings } from './app_specific_settings_schema.js';

class Synonyms {
  static getSynonymsForTextFromSettings(
    text: string,
    synonyms: Record<string, string[]> = {},
  ): string[] {
    const synonymWord = Object.keys(synonyms).find(word => word.includes(text));
    if (synonymWord) {
      return synonyms[synonymWord] ?? [];
    } else {
      return [];
    }
  }

  static mergeMutualSynonymsIntoDirected(synonymsData: SynonymSettings): Record<string, string[]> {
    return {
      ...mutualSynonymSetsToDirected(synonymsData.mutual || []),
      ...(synonymsData.directed || {}),
    };
  }
}

function mutualSynonymSetsToDirected(mutualSynonymSets: string[][]): Record<string, string[]> {
  return mutualSynonymSets.reduce<Record<string, string[]>>((obj, synonymSet) => {
    synonymSet.forEach(word => {
      const otherWordsInSet = synonymSet.filter(otherWordInSet => word !== otherWordInSet);
      const existingSynonyms = obj[word];
      if (existingSynonyms) {
        obj[word] = existingSynonyms.concat(otherWordsInSet);
      } else {
        obj[word] = otherWordsInSet;
      }
    });

    return obj;
  }, {});
}

export default Synonyms;
