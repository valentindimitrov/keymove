import NodeScorer from './node_scorer.js';
import { DEFAULT_RESULT_LIMIT, PageSearchIndex } from './page_search_index.js';
import SearchableAttributeSettings from './searchable_attribute_settings.js';

let index: PageSearchIndex | null = null;
const settings = new SearchableAttributeSettings();

function scorerFor(query: string) {
  return new NodeScorer(query, {}, [], [], {}, settings);
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

test('ranks all results by relevance instead of DOM order', async () => {
  document.body.innerHTML = '<button>Autosave</button><button>Save settings</button>';
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('save'));

  expect(result.matchingLinksAndButtons.map(node => node.textContent)).toEqual([
    'Save settings',
    'Autosave',
  ]);
  expect(result.bestMatchingLinkOrButtonIndex).toBe(0);
});

test('does not treat a shared URL path as matching link text', async () => {
  document.body.innerHTML = `
    <a href="/comake/yip-yip/issues">Issues</a>
    <a href="/comake/yip-yip/pulls">Pull requests</a>
    <a href="/comake/yip-yip">yip-yip</a>
  `;
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('yip'));

  expect(result.matchingLinksAndButtons.map(node => node.textContent)).toEqual(['yip-yip']);
});

test('highlights text matches without adding them to Tab navigation', async () => {
  document.body.innerHTML = `
    <button aria-label="Watch comake/yip-yip">Watch</button>
    <article><p>YipYip is an always-on search assistant.</p></article>
  `;
  const button = document.querySelector('button')!;
  const paragraph = document.querySelector('p')!;
  index = new PageSearchIndex(settings);

  const result = await index.search(scorerFor('yip'));

  expect(result.matchingNodes).toEqual(expect.arrayContaining([button, paragraph]));
  expect(result.matchingLinksAndButtons).toEqual([button]);
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
