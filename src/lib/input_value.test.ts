import { PageSearchIndex } from './page_search_index.js';
import NodeScorer from './node_scorer.js';
import { labelForNode } from './suggestion_context.js';

let index: PageSearchIndex | undefined;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20);
});
afterEach(() => {
  index?.disconnect();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test.each(['text', 'number'])(
  'finds the current %s input value as an action, not stale HTML or page text',
  async type => {
    document.body.innerHTML = `<p id="caption">40 €</p><label for="minimum">Minimum (EUR)</label><input id="minimum" type="${type}" value="10">`;
    const input = document.querySelector('input')!;
    input.value = '40';
    index = new PageSearchIndex();
    const result = await index.search(new NodeScorer('40'));
    expect(result.matchingLinksAndButtons).toEqual([input]);
    expect(result.matchingText.map(match => match.node.id)).toEqual(['caption']);
    expect(labelForNode(input, 'action')).toBe('Minimum (EUR) — 40');
    expect((await index.search(new NodeScorer('10'))).matchingLinksAndButtons).toEqual([]);
    input.value = '65'; // Property-only assignments must be fresh on the next search too.
    expect((await index.search(new NodeScorer('65'))).matchingLinksAndButtons).toEqual([input]);
    expect((await index.search(new NodeScorer('40'))).matchingLinksAndButtons).toEqual([]);
  },
);

test.each(['password', 'hidden', 'checkbox', 'radio', 'range', 'color', 'file'])(
  'never searches internal or secret %s values',
  async type => {
    document.body.innerHTML = `<input type="${type}" value="private-token-5927">`;
    const input = document.querySelector('input')!;
    const read = vi.spyOn(input, 'value', 'get');
    index = new PageSearchIndex();
    expect(
      (await index.search(new NodeScorer('private-token-5927'))).matchingLinksAndButtons,
    ).toEqual([]);
    expect(labelForNode(input, 'action')).not.toContain('private-token-5927');
    expect(read).not.toHaveBeenCalled();
  },
);

test('does not read values from concealed text inputs', async () => {
  document.body.innerHTML = '<input style="display:none" value="private-token-5927">';
  const read = vi.spyOn(document.querySelector('input')!, 'value', 'get');
  index = new PageSearchIndex();
  expect(
    (await index.search(new NodeScorer('private-token-5927'))).matchingLinksAndButtons,
  ).toEqual([]);
  expect(read).not.toHaveBeenCalled();
});

test('refreshes after input/change events but ignores KeyMove input and disconnects listeners', async () => {
  document.body.innerHTML = '<input id="minimum"><div id="keymove-root"><input id="own"></div>';
  const changed = vi.fn();
  index = new PageSearchIndex(changed);
  await index.search(new NodeScorer('40'));
  changed.mockClear();
  const input = document.querySelector('input')!;
  input.value = '40';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(changed).toHaveBeenCalledTimes(1);
  input.value = '65';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(changed).toHaveBeenCalledTimes(2);
  expect((await index.search(new NodeScorer('65'))).matchingLinksAndButtons).toEqual([input]);
  document.getElementById('own')!.dispatchEvent(new Event('input', { bubbles: true }));
  expect(changed).toHaveBeenCalledTimes(2);
  index.disconnect();
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(changed).toHaveBeenCalledTimes(2);
});
