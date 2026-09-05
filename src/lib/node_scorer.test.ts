import NodeScorer from './node_scorer.js';

test('splits words on whitespace and supported separators without treating grouping characters as separators', () => {
  const scorer = new NodeScorer('', {}, [], [], {});

  expect(scorer.getWordsFromText('alpha(beta)+gamma delta-one,two/three')).toEqual([
    'alpha(beta)+gamma',
    'delta',
    'one',
    'two',
    'three',
  ]);
});

test('finds the highest score without sorting or mutating the input', () => {
  const scorer = new NodeScorer('', {}, [], [], {});
  const scores = [0.5, 2, 1];

  expect(scorer.getHighestScore(scores)).toBe(2);
  expect(scores).toEqual([0.5, 2, 1]);
  expect(scorer.getHighestScore([])).toBe(0);
});
