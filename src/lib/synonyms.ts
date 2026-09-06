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
  const directed = new Map<string, string[]>();
  for (const synonymSet of mutualSynonymSets) {
    synonymSet.forEach(word => {
      const otherWordsInSet = synonymSet.filter(otherWordInSet => word !== otherWordInSet);
      directed.set(word, [...(directed.get(word) ?? []), ...otherWordsInSet]);
    });
  }
  return Object.fromEntries(directed);
}

export default Synonyms;
