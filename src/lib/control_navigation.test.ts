import NodeScorer from './node_scorer.js';
import { PageSearchIndex } from './page_search_index.js';
import Utils from './utils.js';
import { labelForNode, kindLabelForNode } from './suggestion_context.js';

let index: PageSearchIndex | undefined;

test.each(['opacity:0', 'display:none', 'visibility:hidden'])(
  'activates a styled radio through its visible label (%s)',
  async style => {
    document.body.innerHTML = `<ul><li id="option"><label id="caption" for="price-high-to-low"><input type="radio" name="sorting-rules" id="price-high-to-low" value="price-high-to-low" style="${style}"><span></span><span>Prix (Haut - Bas)</span></label><label for="price-high-to-low" aria-hidden="true"></label></li></ul>`;
    index = new PageSearchIndex();
    const result = await index.search(new NodeScorer('prix'));
    const label = document.getElementById('caption')!;
    expect(result.matchingLinksAndButtons).toEqual([label]);
    expect(result.matchingText[0]?.node.id).toBe('option');
    expect(result.matchingText[0]?.action).toBe(label);
    expect(kindLabelForNode(label, 'action')).toBe('radio · unselected');
    const radio = document.querySelector('input')!;
    const changed = vi.fn();
    radio.addEventListener('change', changed);
    Utils.clickOrFocusNode(result.matchingText[0]!.action!);
    expect(radio.checked).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
  },
);
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20);
});

test('finds external and implicit checkbox labels without duplicating visible native controls', async () => {
  document.body.innerHTML =
    '<input id="hidden-check" type="checkbox" style="display:none"><label id="external" for="hidden-check"><span>Weekly digest</span></label><label id="implicit">Daily digest<input type="checkbox" style="opacity:0"></label><label>Visible digest<input id="visible" type="checkbox"></label>';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('digest'));
  expect(result.matchingLinksAndButtons.map(node => node.id).sort()).toEqual([
    'external',
    'implicit',
    'visible',
  ]);
  const label = document.getElementById('external')!;
  Utils.clickOrFocusNode(label);
  expect(document.querySelector<HTMLInputElement>('#hidden-check')!.checked).toBe(true);
  Utils.clickOrFocusNode(label);
  expect(document.querySelector<HTMLInputElement>('#hidden-check')!.checked).toBe(false);
});

test('does not invent actions for unassociated labels, hidden-type inputs or decorative labels', async () => {
  document.body.innerHTML =
    '<label>Prix unassociated</label><label for="missing">Prix broken</label><input id="internal" type="hidden"><label for="internal">Prix hidden</label><label aria-hidden="true" for="radio">Prix decorative</label><input id="radio" type="radio" style="opacity:0">';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('prix'));
  expect(result.matchingLinksAndButtons).toEqual([]);
  expect(result.matchingText.every(match => match.action === null)).toBe(true);
});

test('preserves explicit action roles on custom label elements', async () => {
  document.body.innerHTML = '<label role="button" tabindex="0">Open preferences</label>';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('preferences'));
  const label = document.querySelector('label')!;
  expect(result.matchingLinksAndButtons).toEqual([label]);
  const clicked = vi.fn();
  label.addEventListener('click', clicked);
  Utils.clickOrFocusNode(label);
  expect(clicked).toHaveBeenCalledTimes(1);
});

test.each(['disabled', 'aria-disabled="true"'])(
  'respects disabled labelled toggles (%s)',
  async disabled => {
    document.body.innerHTML = `<label id="caption">Prix<input type="radio" style="opacity:0" ${disabled}></label>`;
    index = new PageSearchIndex();
    const result = await index.search(new NodeScorer('prix'));
    const label = document.getElementById('caption')!;
    expect(result.matchingLinksAndButtons).toEqual([label]);
    expect(kindLabelForNode(label, 'action')).toBe('radio · unselected · unavailable');
    Utils.clickOrFocusNode(label);
    expect(document.querySelector('input')!.checked).toBe(false);
    expect(result.matchingText.every(match => match.action === null)).toBe(true);
  },
);

test('revalidates changed label associations and disabled fieldsets', async () => {
  document.body.innerHTML =
    '<fieldset disabled><input id="radio" type="radio" style="opacity:0"></fieldset><label for="radio" id="caption">Prix</label>';
  index = new PageSearchIndex();
  const label = document.getElementById('caption')!;
  Utils.clickOrFocusNode(label);
  expect(document.querySelector('input')!.checked).toBe(false);
  document.querySelector('fieldset')!.disabled = false;
  expect((await index.search(new NodeScorer('prix'))).matchingLinksAndButtons).toEqual([label]);
  label.setAttribute('for', 'missing');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect((await index.search(new NodeScorer('prix'))).matchingLinksAndButtons).toEqual([]);
  Utils.clickOrFocusNode(label);
  expect(document.querySelector('input')!.checked).toBe(false);
});

test('does not activate controls outside the modal or in an inert subtree through labels', async () => {
  document.body.innerHTML =
    '<input id="outside" type="radio" style="opacity:0"><section role="dialog" aria-modal="true"><label for="outside">Prix outside</label><div inert><input id="inert" type="checkbox" style="opacity:0"></div><label for="inert">Prix inert</label></section>';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('prix'));
  expect(result.matchingLinksAndButtons).toEqual([]);
  expect(result.matchingText.every(match => match.action === null)).toBe(true);
});
afterEach(() => {
  index?.disconnect();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test.each([
  ['<label for="target">Email address</label><input id="target">', 'email address'],
  ['<label>Weekly updates<input id="target" type="checkbox"></label>', 'weekly updates'],
  [
    '<span id="name" hidden>Night mode</span><span id="target" role="switch" tabindex="0" aria-labelledby="name"></span>',
    'night mode',
  ],
  ['<a id="target" href="/"><img alt="Home"></a>', 'home'],
  ['<details><summary id="target">Advanced settings</summary></details>', 'advanced settings'],
  ['<div id="target" contenteditable="true" aria-label="Message editor"></div>', 'message editor'],
  [
    '<section id="target" role="radio" tabindex="0" aria-label="Express delivery"></section>',
    'express delivery',
  ],
])('discovers control names and displays them: %s', async (html, query) => {
  document.body.innerHTML = html;
  index = new PageSearchIndex();
  const target = document.getElementById('target')!;
  const result = await index.search(new NodeScorer(query));
  expect(result.matchingLinksAndButtons).toContain(target);
  expect(labelForNode(target, 'action').toLowerCase()).toBe(query);
});

test('refreshes referenced labels and keeps their text out of the control text result', async () => {
  document.body.innerHTML =
    '<span id="name" hidden>First name</span><input id="target" aria-labelledby="name">';
  index = new PageSearchIndex();
  expect((await index.search(new NodeScorer('first name'))).matchingLinksAndButtons).toHaveLength(
    1,
  );
  document.getElementById('name')!.textContent = 'Family name';
  await new Promise(resolve => setTimeout(resolve, 0));
  const result = await index.search(new NodeScorer('family name'));
  expect(result.matchingLinksAndButtons).toHaveLength(1);
  expect(result.matchingText).toEqual([]);
  expect((await index.search(new NodeScorer('first name'))).matchingLinksAndButtons).toEqual([]);
});

test('does not treat a generic tabindex as a clickable action', async () => {
  document.body.innerHTML = '<div tabindex="0">Focusable region</div>';
  index = new PageSearchIndex();
  expect((await index.search(new NodeScorer('focusable'))).matchingLinksAndButtons).toEqual([]);
});

test('resolves multiple label references, normalizes their whitespace and ignores broken references', async () => {
  document.body.innerHTML =
    '<span id="first" hidden>Cafe\u0301   delivery</span><span id="last">address</span><input id="target" aria-label="Wrong label" aria-labelledby="missing first last">';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('café delivery address'));
  expect(result.matchingLinksAndButtons).toEqual([document.getElementById('target')]);
  expect(labelForNode(document.getElementById('target')!, 'action')).toBe(
    'Cafe\u0301 delivery address',
  );
});

test('leaves typeahead with a custom widget after focus handoff', () => {
  document.body.innerHTML = '<div role="listbox" tabindex="0"></div><input id="search">';
  Utils.clickOrFocusNode(document.querySelector('div')!);
  expect(Utils.differentInputIsActive(document.getElementById('search'))).toBe(true);
});

test('names a submit input by its visible caption before its internal name', () => {
  document.body.innerHTML = '<input type="submit" name="operation" value="Confirm order">';
  expect(labelForNode(document.querySelector('input')!, 'action')).toBe('Confirm order');
});

test('toggles checkboxes, selects radios, submits native input buttons and expands disclosures', () => {
  document.body.innerHTML =
    '<input type="checkbox"><input type="radio"><input type="submit"><details><summary>Advanced</summary></details>';
  const checkbox = document.querySelector<HTMLInputElement>('[type=checkbox]')!;
  const radio = document.querySelector<HTMLInputElement>('[type=radio]')!;
  const submit = document.querySelector<HTMLInputElement>('[type=submit]')!;
  const clicked = vi.fn();
  submit.addEventListener('click', clicked);
  Utils.clickOrFocusNode(checkbox);
  expect(checkbox.checked).toBe(true);
  Utils.clickOrFocusNode(checkbox);
  expect(checkbox.checked).toBe(false);
  Utils.clickOrFocusNode(radio);
  expect(radio.checked).toBe(true);
  Utils.clickOrFocusNode(submit);
  expect(clicked).toHaveBeenCalledOnce();
  Utils.clickOrFocusNode(document.querySelector('summary')!);
  expect(document.querySelector('details')!.open).toBe(true);
});

test('hands focus to editors and complex widgets without clicking them', () => {
  document.body.innerHTML =
    '<div contenteditable="true" tabindex="0"></div><div role="combobox" tabindex="0"></div>';
  for (const node of document.querySelectorAll<HTMLElement>('div')) {
    const clicked = vi.fn();
    node.addEventListener('click', clicked);
    Utils.clickOrFocusNode(node);
    expect(document.activeElement).toBe(node);
    expect(clicked).not.toHaveBeenCalled();
  }
});

test('never activates disabled or inert controls, including a disabled fieldset', () => {
  document.body.innerHTML =
    '<button disabled>Save</button><div aria-disabled="true"><button>Save</button></div><fieldset disabled><input type="submit"></fieldset><div inert><button>Save</button></div>';
  for (const node of document.querySelectorAll<HTMLElement>('button, input')) {
    const clicked = vi.fn();
    node.addEventListener('click', clicked);
    Utils.clickOrFocusNode(node);
    expect(clicked).not.toHaveBeenCalled();
  }
});
