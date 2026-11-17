import NodeScorer from './node_scorer.js';

test.each([
  ['save', 'ordinary text', [], 0],
  ['save', 'save settings', [], 1.5],
  ['save', 'autosave', [], 1],
  ['save', 'ordinary text', ['autosave'], 0.9],
  ['save', 'autosave', ['save settings'], 1.35],
  ['save', 'save settings', ['save'], 1.5],
  // The strongest attribute decides, wherever it is in the list.
  ['save', 'ordinary text', ['autosave', 'save settings'], 1.35],
  ['save', 'ordinary text', ['save settings', 'autosave'], 1.35],
  ['account settings', 'account\u00a0settings', [], 1.5],
  ['строй', 'настройки', [], 1],
  ['настрой', 'настройки', [], 1.5],
] as const)(
  'preserves ranking for %s in %s with attributes %j',
  (query, text, attributes, expected) => {
    const scorer = new NodeScorer(query);
    const node = document.createElement('p');
    expect(scorer.score(node, text, [...attributes])).toBeCloseTo(expected);
  },
);

test('splits words on whitespace and supported separators without treating grouping characters as separators', () => {
  const scorer = new NodeScorer('');

  expect(scorer.getWordsFromText('alpha(beta)+gamma delta-one,two/three')).toEqual([
    'alpha(beta)+gamma',
    'delta',
    'one',
    'two',
    'three',
  ]);
});
