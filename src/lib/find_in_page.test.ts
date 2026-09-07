import FindInPage, { releasePageSearchIndex, subscribeToPageChanges } from './find_in_page.js';
import { PageSearchIndex } from './page_search_index.js';

afterEach(() => {
  releasePageSearchIndex();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

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

test('does not create an observer for an empty query', async () => {
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  await new FindInPage(' ').findMatches();
  expect(observe).not.toHaveBeenCalled();
});

test('searches from the first character and reuses the index on subsequent keystrokes', async () => {
  document.body.innerHTML = '<p>Save settings</p>';
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  for (const query of ['s', 'sa', 'sav', 'save']) {
    expect((await new FindInPage(query).findMatches()).matchingText).toHaveLength(1);
  }
  expect(observe).toHaveBeenCalledOnce();
});

test('releases the shared observer after the last search subscriber leaves', async () => {
  const disconnect = vi.spyOn(PageSearchIndex.prototype, 'disconnect');
  const unsubscribeFirst = subscribeToPageChanges(vi.fn());
  const unsubscribeLast = subscribeToPageChanges(vi.fn());
  document.body.innerHTML = '<button>Save</button>';
  await new FindInPage('save').findMatches();
  unsubscribeFirst();
  expect(disconnect).not.toHaveBeenCalled();
  unsubscribeLast();
  expect(disconnect).toHaveBeenCalledOnce();
  expect((await new FindInPage('save').findMatches()).matchingLinksAndButtons).toHaveLength(1);
});

test('rebuilds the shared index when the document body is replaced', async () => {
  document.body.innerHTML = '<button>Old action</button>';
  expect((await new FindInPage('old').findMatches()).matchingLinksAndButtons).toHaveLength(1);
  const changed = vi.fn();
  const unsubscribe = subscribeToPageChanges(changed);

  const replacementBody = document.createElement('body');
  replacementBody.innerHTML = '<button>New action</button>';
  document.documentElement.replaceChild(replacementBody, document.body);
  await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  expect(changed).toHaveBeenCalledOnce();
  unsubscribe();
  const newButton = replacementBody.querySelector('button');

  expect((await new FindInPage('new').findMatches()).matchingLinksAndButtons).toEqual([newButton]);
});
