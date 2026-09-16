import { kindLabelForNode } from './suggestion_context.js';
import { PageSearchIndex } from './page_search_index.js';
import NodeScorer from './node_scorer.js';

let index: PageSearchIndex | undefined;

afterEach(() => {
  index?.disconnect();
  index = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test.each([
  ['<input type="checkbox">', 'checkbox · unchecked'],
  ['<input type="checkbox" checked aria-checked="false">', 'checkbox · checked'],
  ['<input type="radio" checked aria-checked="false">', 'radio · selected'],
  ['<input type="radio">', 'radio · unselected'],
  ['<div role="checkbox" aria-checked="mixed"></div>', 'checkbox · partially checked'],
  ['<div role="checkbox" aria-checked="false"></div>', 'checkbox · unchecked'],
  ['<div role="radio" aria-checked="true"></div>', 'radio · selected'],
  ['<div role="radio" aria-checked="false"></div>', 'radio · unselected'],
  ['<div role="switch" aria-checked="true"></div>', 'switch · on'],
  ['<div role="switch" aria-checked="false"></div>', 'switch · off'],
  ['<div role="switch" aria-checked="mixed"></div>', 'switch'],
  ['<div role="checkbox"></div>', 'checkbox'],
  ['<div role="checkbox" aria-checked="invalid"></div>', 'checkbox'],
  ['<button aria-expanded="false">Price</button>', 'button · collapsed'],
  ['<button aria-expanded="true">Price</button>', 'button · expanded'],
  ['<button aria-expanded="invalid">Price</button>', 'button'],
  ['<input type="checkbox" checked disabled>', 'checkbox · checked · unavailable'],
])('describes explicit control state: %s', (html, expected) => {
  document.body.innerHTML = html;
  expect(kindLabelForNode(document.body.firstElementChild!, 'action')).toBe(expected);
});

test('reads live native properties and associated styled controls, not stale attributes', () => {
  document.body.innerHTML =
    '<label for="toggle">Digest</label><input id="toggle" type="checkbox" checked style="display:none">';
  const control = document.querySelector('input')!;
  const label = document.querySelector('label')!;
  control.checked = false;
  expect(kindLabelForNode(label, 'action')).toBe('checkbox · unchecked');
  control.indeterminate = true;
  expect(kindLabelForNode(label, 'action')).toBe('checkbox · partially checked');
  expect(kindLabelForNode(label, 'text')).toBe('paragraph');
});

test('reads native disclosure state before stale ARIA', () => {
  document.body.innerHTML = '<details><summary aria-expanded="true">Advanced</summary></details>';
  const details = document.querySelector('details')!;
  const summary = document.querySelector('summary')!;
  expect(kindLabelForNode(summary, 'action')).toBe('disclosure · collapsed');
  details.open = true;
  summary.setAttribute('aria-expanded', 'false');
  expect(kindLabelForNode(summary, 'action')).toBe('disclosure · expanded');
});

test.each(['checkbox', 'radio'])(
  'refreshes native %s property changes and removes listeners on disconnect',
  type => {
    document.body.innerHTML = `<input type="${type}">`;
    const changed = vi.fn();
    index = new PageSearchIndex(changed);
    const control = document.querySelector('input')!;
    control.checked = true;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changed).toHaveBeenCalledOnce();
    control.dispatchEvent(new Event('input', { bubbles: true }));
    expect(changed).toHaveBeenCalledTimes(2);
    index.disconnect();
    control.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changed).toHaveBeenCalledTimes(2);
  },
);

test('keeps generated states out of search matching', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20);
  document.body.innerHTML =
    '<label>Digest<input type="checkbox" checked></label><button aria-expanded="false">Price</button>';
  index = new PageSearchIndex();
  for (const query of ['checked', 'collapsed', 'unavailable']) {
    const result = await index.search(new NodeScorer(query));
    expect(result.matchingLinksAndButtons).toEqual([]);
    expect(result.matchingText).toEqual([]);
  }
});
