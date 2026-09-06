import NodeScorer from './node_scorer.js';
import { DEFAULT_RESULT_LIMIT, PageSearchIndex } from './page_search_index.js';
import SearchableAttributeSettings from './searchable_attribute_settings.js';

let index: PageSearchIndex | null = null;
const settings = new SearchableAttributeSettings();

function scorerFor(query: string) {
  return new NodeScorer(query, {}, [], [], {});
}

function waitForMutations() {
  return new Promise<void>(resolve => window.setTimeout(resolve, 0));
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 20,
  });
});

afterEach(() => {
  if (index) {
    index.disconnect();
    index = null;
  }
  document.body.innerHTML = '';
});

test('ranks action results by relevance instead of DOM order', async () => {
  document.body.innerHTML = '<button>Autosave</button><button>Save settings</button>';
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('save'));

  expect(result.matchingLinksAndButtons.map(node => node.textContent)).toEqual([
    'Save settings',
    'Autosave',
  ]);
});

test('does not match hidden descendant text inside a visible block', async () => {
  document.body.innerHTML =
    '<p>Visible text <span hidden>secret</span><span style="opacity: 0">private</span></p>';
  index = new PageSearchIndex(settings);
  expect((await index.search(scorerFor('secret'))).matchingText).toEqual([]);
  expect((await index.search(scorerFor('private'))).matchingText).toEqual([]);
});

test('rechecks descendant visibility after an ancestor class changes', async () => {
  document.body.innerHTML =
    '<style>.concealed span { display: none; }</style><main><p>Visible <span>secret</span></p></main>';
  index = new PageSearchIndex(settings);
  expect((await index.search(scorerFor('secret'))).matchingText).toHaveLength(1);
  document.querySelector('main')!.className = 'concealed';
  await waitForMutations();
  expect((await index.search(scorerFor('secret'))).matchingText).toEqual([]);
});

test('finds a phrase split across inline descendants as one semantic block', async () => {
  document.body.innerHTML = '<p><span>Save </span><strong>settings</strong></p>';
  index = new PageSearchIndex(settings);
  expect((await index.search(scorerFor('save settings'))).matchingText).toEqual([
    { node: document.querySelector('p'), action: null },
  ]);
});

test('keeps text navigation in document order after inserting an earlier result', async () => {
  document.body.innerHTML = '<p>Save second</p>';
  index = new PageSearchIndex(settings);
  document.body.insertAdjacentHTML('afterbegin', '<p>Save first</p>');
  await waitForMutations();
  expect(
    (await index.search(scorerFor('save'))).matchingText.map(match => match.node.textContent),
  ).toEqual(['Save first', 'Save second']);
});

test('notifies page changes while ignoring extension host reattachment', async () => {
  const onChange = vi.fn();
  index = new PageSearchIndex(settings, [], onChange);
  document.body.insertAdjacentHTML('beforeend', '<div id="keymove-root"></div>');
  await waitForMutations();
  expect(onChange).not.toHaveBeenCalled();
  document.body.insertAdjacentHTML('beforeend', '<p>Save</p>');
  await waitForMutations();
  expect(onChange).toHaveBeenCalledOnce();
});

test('discovers attribute-only custom actions when an ancestor starts matching', async () => {
  document.body.innerHTML = '<main><div aria-label="Save"></div></main>';
  index = new PageSearchIndex(new SearchableAttributeSettings(['.enabled div']));
  expect((await index.search(scorerFor('save'))).matchingLinksAndButtons).toEqual([]);
  document.querySelector('main')!.className = 'enabled';
  await waitForMutations();
  expect((await index.search(scorerFor('save'))).matchingLinksAndButtons).toEqual([
    document.querySelector('div'),
  ]);
});

test('does not treat a shared URL path as matching link text', async () => {
  document.body.innerHTML = `
    <a href="/comake/keymove/issues">Issues</a>
    <a href="/comake/keymove/pulls">Pull requests</a>
    <a href="/comake/keymove">keymove</a>
  `;
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('key'));

  expect(result.matchingLinksAndButtons.map(node => node.textContent)).toEqual(['keymove']);
});

test('keeps attribute-only action matches out of text navigation', async () => {
  document.body.innerHTML = `
    <button aria-label="Watch comake/keymove">Watch</button>
    <article><p>KeyMove is an always-on search assistant.</p></article>
  `;
  const button = document.querySelector('button')!;
  const paragraph = document.querySelector('p')!;
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('key'));

  expect(result.matchingText).toEqual([{ node: paragraph, action: null }]);
  expect(result.matchingLinksAndButtons).toEqual([button]);
});

test('uses a whole text block while retaining its nested action', async () => {
  document.body.innerHTML =
    '<article><p>Read the <a href="/docs">documentation</a> now.</p></article>';
  const paragraph = document.querySelector('p')!;
  const link = document.querySelector('a')!;
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('documentation'));

  expect(result.matchingText).toEqual([{ node: paragraph, action: link }]);
  expect(result.matchingLinksAndButtons).toEqual([link]);
});

test('associates the matching nested link before falling back to another block action', async () => {
  document.body.innerHTML = '<p>Read <a href="/home">home</a> or <a href="/docs">documentation</a>.</p>';
  index = new PageSearchIndex(settings);
  expect((await index.search(scorerFor('documentation'))).matchingText).toEqual([
    { node: document.querySelector('p'), action: document.querySelector('a[href="/docs"]') },
  ]);
});

test('refreshes cached records when the page mutates', async () => {
  document.body.innerHTML = '<button>Save</button>';
  const button = document.querySelector('button')!;
  index = new PageSearchIndex(settings);

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toHaveLength(0);

  button.textContent = 'Publish';
  await waitForMutations();

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toEqual([button]);
});

test('adds and removes candidates when their role changes', async () => {
  document.body.innerHTML = '<div>Archive</div>';
  const candidate = document.querySelector('div')!;
  index = new PageSearchIndex(settings);

  expect((await index.search(scorerFor('archive'))).matchingLinksAndButtons).toHaveLength(0);

  candidate.setAttribute('role', 'button');
  await waitForMutations();
  expect((await index.search(scorerFor('archive'))).matchingLinksAndButtons).toEqual([candidate]);

  candidate.removeAttribute('role');
  await waitForMutations();
  expect((await index.search(scorerFor('archive'))).matchingLinksAndButtons).toHaveLength(0);
});

test('does not re-index an entire default subtree after an attribute change', async () => {
  document.body.innerHTML = `<main>${Array.from(
    { length: 500 },
    (_, itemIndex) => `<button>Item ${itemIndex}</button>`,
  ).join('')}</main>`;
  const container = document.querySelector('main')!;
  index = new PageSearchIndex(settings);
  const refreshCandidate = vi.spyOn(index, 'refreshCandidate');

  container.classList.add('updated');
  await waitForMutations();

  expect(refreshCandidate).toHaveBeenCalledTimes(1);
  expect(refreshCandidate).toHaveBeenCalledWith(container);
});

test('re-evaluates visibility without rebuilding cached search records', async () => {
  document.body.innerHTML = '<button>Publish</button>';
  const button = document.querySelector('button')!;
  index = new PageSearchIndex(settings);

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toEqual([button]);

  button.style.visibility = 'hidden';
  await waitForMutations();
  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toHaveLength(0);
});

test('limits the rendered result set', async () => {
  document.body.innerHTML = Array.from(
    { length: DEFAULT_RESULT_LIMIT + 10 },
    (_, index) => `<button>Save ${index}</button>`,
  ).join('');
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('save'));

  expect(result.matchingLinksAndButtons).toHaveLength(DEFAULT_RESULT_LIMIT);
});

test('cancels obsolete searches', async () => {
  document.body.innerHTML = '<button>Save</button>';
  index = new PageSearchIndex(settings);
  const controller = new AbortController();
  controller.abort();

  await expect(
    index.search(scorerFor('save'), { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
