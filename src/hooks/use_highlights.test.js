import { highlightRangesForNodes, rangesForTextNode } from './use_highlights.js';

afterEach(() => {
  document.body.innerHTML = '';
});

test('creates a range for every case-insensitive match without changing the DOM', () => {
  const button = document.createElement('button');
  button.innerHTML = '<span>Save</span> and save again';
  document.body.appendChild(button);
  const originalMarkup = button.innerHTML;

  const ranges = highlightRangesForNodes([button], 'save');

  expect(ranges.map(range => range.toString())).toEqual(['Save', 'save']);
  expect(button.innerHTML).toBe(originalMarkup);
  expect(button.querySelector('mark')).toBeNull();
});

test('does not duplicate ranges when matching nodes overlap', () => {
  const button = document.createElement('button');
  button.innerHTML = '<span>Save</span>';
  document.body.appendChild(button);

  const ranges = highlightRangesForNodes([button, button.querySelector('span')], 'save');

  expect(ranges).toHaveLength(1);
});

test('finds repeated matches within one text node', () => {
  const textNode = document.createTextNode('go go go');
  expect(rangesForTextNode(textNode, 'go')).toHaveLength(3);
});
