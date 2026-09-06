import Synonyms from './synonyms.js';

test('treats prototype property names as ordinary synonym words', () => {
  const synonyms = Synonyms.mergeMutualSynonymsIntoDirected({
    mutual: [
      ['__proto__', 'constructor', 'save'],
      ['save', 'publish'],
    ],
  });
  expect(Object.hasOwn(synonyms, '__proto__')).toBe(true);
  expect(Synonyms.getSynonymsForTextFromSettings('__proto__', synonyms)).toEqual([
    'constructor',
    'save',
  ]);
  expect(synonyms['save']).toEqual(['__proto__', 'constructor', 'publish']);
  expect(Object.getPrototypeOf(synonyms)).toBe(Object.prototype);
});
