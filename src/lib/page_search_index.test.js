import NodeScorer from './node_scorer.js';
import { DEFAULT_RESULT_LIMIT, PageSearchIndex } from './page_search_index.js';
import SearchableAttributeSettings from './searchable_attribute_settings.js';

let index;
const settings = new SearchableAttributeSettings();

function scorerFor(query) {
  return new NodeScorer(query, {}, [], [], {}, settings);
}

function waitForMutations() {
  return new Promise(resolve => window.setTimeout(resolve, 0));
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 100
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 20
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
    'Autosave'
  ]);
  expect(result.bestMatchingLinkOrButtonIndex).toBe(0);
});

test('refreshes cached records when the page mutates', async () => {
  document.body.innerHTML = '<button>Save</button>';
  const button = document.querySelector('button');
  index = new PageSearchIndex(settings);

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toHaveLength(0);

  button.textContent = 'Publish';
  await waitForMutations();

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toEqual([button]);
});

test('adds and removes candidates when their role changes', async () => {
  document.body.innerHTML = '<div>Archive</div>';
  const candidate = document.querySelector('div');
  index = new PageSearchIndex(settings);

  expect((await index.search(scorerFor('archive'))).matchingLinksAndButtons).toHaveLength(0);

  candidate.setAttribute('role', 'button');
  await waitForMutations();
  expect((await index.search(scorerFor('archive'))).matchingLinksAndButtons).toEqual([candidate]);

  candidate.removeAttribute('role');
  await waitForMutations();
  expect((await index.search(scorerFor('archive'))).matchingLinksAndButtons).toHaveLength(0);
});

test('limits the rendered result set', async () => {
  document.body.innerHTML = Array.from({ length: DEFAULT_RESULT_LIMIT + 10 }, (_, index) =>
    `<button>Save ${index}</button>`
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

  await expect(index.search(scorerFor('save'), { signal: controller.signal }))
    .rejects.toMatchObject({ name: 'AbortError' });
});
