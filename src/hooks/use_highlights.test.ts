import {
  highlightRangesForNodes,
  rangesForTextNode,
  MAX_HIGHLIGHT_RANGES,
} from './use_highlights.js';

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

  const ranges = highlightRangesForNodes([button, button.querySelector('span')!], 'save');

  expect(ranges).toHaveLength(1);
});

test('finds repeated matches within one text node', () => {
  const textNode = document.createTextNode('go go go');
  expect(rangesForTextNode(textNode, 'go')).toHaveLength(3);
});

test('highlights phrases across inline nodes without highlighting hidden text', () => {
  const paragraph = document.createElement('p');
  paragraph.innerHTML =
    '<span>Save </span><strong>settings</strong><span hidden>save settings</span>';
  document.body.append(paragraph);
  const ranges = highlightRangesForNodes([paragraph], 'save settings');
  expect(ranges.map(range => range.toString())).toEqual(['Save settings']);
});

test('keeps DOM range offsets correct after lowercase expansion', () => {
  const text = document.createTextNode('\u0130 Save');
  expect(rangesForTextNode(text, 'save').map(range => range.toString())).toEqual(['Save']);
  expect(rangesForTextNode(text, '')).toEqual([]);
});

test('bounds highlight allocation on a page with tens of thousands of matches', () => {
  const text = document.createTextNode('go '.repeat(60_000));
  const ranges = rangesForTextNode(text, 'go');
  expect(ranges).toHaveLength(MAX_HIGHLIGHT_RANGES);
  expect(ranges.at(-1)?.toString()).toBe('go');
});

test('shares the highlight limit across blocks', () => {
  document.body.innerHTML = `<p>${'go '.repeat(400)}</p><p>${'go '.repeat(400)}</p>`;
  expect(highlightRangesForNodes([...document.querySelectorAll('p')], 'go')).toHaveLength(
    MAX_HIGHLIGHT_RANGES,
  );
});

test('maps expanded and supplementary characters across adjacent text nodes', () => {
  document.body.innerHTML = '<p><span>\u0130 😀 Sa</span><b>ve</b> <i>Save</i></p>';
  expect(
    highlightRangesForNodes([document.querySelector('p')!], 'save').map(range => range.toString()),
  ).toEqual(['Save', 'Save']);
});
