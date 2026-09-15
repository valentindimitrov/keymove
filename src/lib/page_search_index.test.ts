import NodeScorer from './node_scorer.js';
import { PageSearchIndex } from './page_search_index.js';

let index: PageSearchIndex | null = null;

function scorerFor(query: string) {
  return new NodeScorer(query);
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('ranks action results by relevance instead of DOM order', async () => {
  document.body.innerHTML = '<button>Autosave</button><button>Save settings</button>';
  index = new PageSearchIndex();

  const result = await index.search(scorerFor('save'));

  expect(result.matchingLinksAndButtons.map(node => node.textContent)).toEqual([
    'Save settings',
    'Autosave',
  ]);
});

test('does not match hidden descendant text inside a visible block', async () => {
  document.body.innerHTML =
    '<p>Visible text <span hidden>secret</span><span style="opacity: 0">private</span></p>';
  index = new PageSearchIndex();
  expect((await index.search(scorerFor('secret'))).matchingText).toEqual([]);
  expect((await index.search(scorerFor('private'))).matchingText).toEqual([]);
});

test('rechecks descendant visibility after an ancestor class changes', async () => {
  document.body.innerHTML =
    '<style>.concealed span { display: none; }</style><main><p>Visible <span>secret</span></p></main>';
  index = new PageSearchIndex();
  expect((await index.search(scorerFor('secret'))).matchingText).toHaveLength(1);
  document.querySelector('main')!.className = 'concealed';
  await waitForMutations();
  expect((await index.search(scorerFor('secret'))).matchingText).toEqual([]);
});

test('finds a phrase split across inline descendants as one semantic block', async () => {
  document.body.innerHTML = '<p><span>Save </span><strong>settings</strong></p>';
  index = new PageSearchIndex();
  expect((await index.search(scorerFor('save settings'))).matchingText).toMatchObject([
    { node: document.querySelector('p'), action: null, term: 'save settings' },
  ]);
});

test('keeps text navigation in document order after inserting an earlier result', async () => {
  document.body.innerHTML = '<p>Save second</p>';
  index = new PageSearchIndex();
  document.body.insertAdjacentHTML('afterbegin', '<p>Save first</p>');
  await waitForMutations();
  expect(
    (await index.search(scorerFor('save'))).matchingText.map(match => match.node.textContent),
  ).toEqual(['Save first', 'Save second']);
});

test('notifies page changes while ignoring extension host reattachment', async () => {
  const onChange = vi.fn();
  index = new PageSearchIndex(onChange);
  document.body.insertAdjacentHTML('beforeend', '<div id="keymove-root"></div>');
  await waitForMutations();
  expect(onChange).not.toHaveBeenCalled();
  document.body.insertAdjacentHTML('beforeend', '<p>Save</p>');
  await waitForMutations();
  expect(onChange).toHaveBeenCalledOnce();
});

test('keeps attribute-only action matches out of text navigation', async () => {
  document.body.innerHTML = `
    <button aria-label="Watch keymove">Watch</button>
    <article><p>KeyMove is an always-on search assistant.</p></article>
  `;
  const button = document.querySelector('button')!;
  const paragraph = document.querySelector('p')!;
  index = new PageSearchIndex();

  const result = await index.search(scorerFor('key'));

  expect(result.matchingText).toMatchObject([{ node: paragraph, action: null, term: 'key' }]);
  expect(result.matchingLinksAndButtons).toEqual([button]);
});

test('uses a whole text block while retaining its nested action', async () => {
  document.body.innerHTML =
    '<article><p>Read the <a href="/docs">documentation</a> now.</p></article>';
  const paragraph = document.querySelector('p')!;
  const link = document.querySelector('a')!;
  index = new PageSearchIndex();

  const result = await index.search(scorerFor('documentation'));

  expect(result.matchingText).toMatchObject([
    { node: paragraph, action: link, term: 'documentation' },
  ]);
  expect(result.matchingLinksAndButtons).toEqual([link]);
});

test('associates the matching nested link before falling back to another block action', async () => {
  document.body.innerHTML =
    '<p>Read <a href="/home">home</a> or <a href="/docs">documentation</a>.</p>';
  index = new PageSearchIndex();
  expect((await index.search(scorerFor('documentation'))).matchingText).toMatchObject([
    {
      node: document.querySelector('p'),
      action: document.querySelector('a[href="/docs"]'),
      term: 'documentation',
    },
  ]);
});

test('refreshes cached records when the page mutates', async () => {
  document.body.innerHTML = '<button>Save</button>';
  const button = document.querySelector('button')!;
  index = new PageSearchIndex();

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toHaveLength(0);

  button.textContent = 'Publish';
  await waitForMutations();

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toEqual([button]);
});

test('adds and removes candidates when their role changes', async () => {
  document.body.innerHTML = '<div>Archive</div>';
  const candidate = document.querySelector('div')!;
  index = new PageSearchIndex();

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
  index = new PageSearchIndex();
  const refreshCandidate = vi.spyOn(index, 'refreshCandidate');

  container.classList.add('updated');
  await waitForMutations();

  expect(refreshCandidate).toHaveBeenCalledTimes(1);
  expect(refreshCandidate).toHaveBeenCalledWith(container);
});

test('re-evaluates visibility without rebuilding cached search records', async () => {
  document.body.innerHTML = '<button>Publish</button>';
  const button = document.querySelector('button')!;
  index = new PageSearchIndex();

  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toEqual([button]);

  button.style.visibility = 'hidden';
  await waitForMutations();
  expect((await index.search(scorerFor('publish'))).matchingLinksAndButtons).toHaveLength(0);
});

test.each(['save', 'savve'])('retains all exact and fuzzy matches for %s', async query => {
  document.body.innerHTML = Array.from(
    { length: 65 },
    (_, index) => `<button>Save ${index}</button>`,
  ).join('');
  index = new PageSearchIndex();

  const result = await index.search(scorerFor(query));

  expect(result.matchingLinksAndButtons).toHaveLength(65);
  expect(result.matchingText).toHaveLength(65);
  expect(new Set(result.matchingText.map(match => match.node)).size).toBe(65);
  expect(result.isFuzzy).toBe(query === 'savve');
});

test('cancels obsolete searches', async () => {
  document.body.innerHTML = '<button>Save</button>';
  index = new PageSearchIndex();
  const controller = new AbortController();
  controller.abort();

  await expect(
    index.search(scorerFor('save'), { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
});

test('can cancel while ordering an uncapped result set', async () => {
  document.body.innerHTML = '<p>Save</p>'.repeat(250);
  index = new PageSearchIndex();
  const controller = new AbortController();
  let elapsed = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => {
    elapsed += 8;
    return elapsed;
  });
  const compare = Element.prototype.compareDocumentPosition;
  let sortingStarted = false;
  vi.spyOn(Element.prototype, 'compareDocumentPosition').mockImplementation(function (
    this: Element,
    other: Node,
  ) {
    if (!sortingStarted) {
      sortingStarted = true;
      window.setTimeout(() => controller.abort(), 0);
    }
    return compare.call(this, other);
  });

  await expect(
    index.search(scorerFor('save'), { signal: controller.signal }),
  ).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(sortingStarted).toBe(true);
});

test('defers initial indexing, cancels queued work immediately, and resumes the full scan', async () => {
  document.body.innerHTML = `${'<p>Save</p>'.repeat(250)}<button>Unique result</button>`;
  vi.useFakeTimers();
  let elapsed = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => {
    elapsed += 8;
    return elapsed;
  });
  index = new PageSearchIndex();
  expect(index.records.size).toBe(0);
  const controller = new AbortController();
  const pending = index.search(scorerFor('unique'), { signal: controller.signal });
  expect(index.records.size).toBeGreaterThan(0);
  expect(index.records.size).toBeLessThan(250);
  expect(vi.getTimerCount()).toBe(1);
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejected;
  expect(vi.getTimerCount()).toBe(0);

  const resumed = index.search(scorerFor('unique'));
  await vi.runAllTimersAsync();
  expect((await resumed).matchingLinksAndButtons).toEqual([document.querySelector('button')]);
});

test('does not add timer or idle waits when index work fits within its time budget', async () => {
  document.body.innerHTML = '<p>Save settings</p>'.repeat(250);
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const timer = vi.spyOn(window, 'setTimeout');
  index = new PageSearchIndex();
  expect((await index.search(scorerFor('save'))).matchingText).toHaveLength(250);
  expect(timer).not.toHaveBeenCalled();
});

test('disconnect cancels pending work and releases indexed DOM nodes', async () => {
  document.body.innerHTML = '<p>Save</p>'.repeat(250);
  vi.useFakeTimers();
  index = new PageSearchIndex();
  const pending = index.search(scorerFor('save'));
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  index.disconnect();
  await rejected;
  expect(index.records.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  await expect(index.search(scorerFor('save'))).rejects.toMatchObject({ name: 'AbortError' });
});

test('defers large inserted subtrees until a cancellable search runs', async () => {
  index = new PageSearchIndex();
  await index.search(scorerFor('save'));
  const refresh = vi.spyOn(index, 'refreshCandidate');
  document.body.innerHTML = `<main>${'<button>Save</button>'.repeat(250)}</main>`;
  await waitForMutations();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect((await index.search(scorerFor('save'))).matchingLinksAndButtons).toHaveLength(250);
});

test('retains page order for all text and relevance order for all actions', async () => {
  document.body.innerHTML = `${'<button>Autosave</button>'.repeat(60)}<button>Save settings</button>`;
  index = new PageSearchIndex();
  const firstButton = document.querySelector('button');
  const result = await index.search(scorerFor('save'));
  expect(result.matchingText).toHaveLength(61);
  expect(result.matchingLinksAndButtons).toHaveLength(61);
  expect(result.matchingText.slice(0, 1)).toMatchObject([
    { node: firstButton, action: firstButton, term: 'save' },
  ]);
  expect(result.matchingLinksAndButtons[0]?.textContent).toBe('Save settings');
});

test('falls back to approximate matching only when nothing matched exactly', async () => {
  document.body.innerHTML = '<p>Open the settings panel</p>';
  index = new PageSearchIndex();

  const exact = await index.search(scorerFor('settings'));
  expect(exact.isFuzzy).toBe(false);
  expect(exact.matchingText).toHaveLength(1);
  expect(exact.matchingText[0]!.term).toBe('settings');

  const fuzzy = await index.search(scorerFor('setings'));
  expect(fuzzy.isFuzzy).toBe(true);
  expect(fuzzy.matchingText.map(match => match.node)).toEqual([document.querySelector('p')]);
  // The term is the page's spelling, not the query, so highlighting can locate it.
  expect(fuzzy.matchingText[0]!.term).toBe('settings');
});

test('leaves an exact match unaccompanied by near misses elsewhere on the page', async () => {
  document.body.innerHTML = '<p>Save now</p><p>Sace later</p>';
  index = new PageSearchIndex();

  const result = await index.search(scorerFor('save'));

  expect(result.isFuzzy).toBe(false);
  expect(result.matchingText.map(match => match.node.textContent)).toEqual(['Save now']);
});

test('matches actions approximately by their label', async () => {
  document.body.innerHTML = '<button>Compose</button><button>Archive</button>';
  index = new PageSearchIndex();

  const result = await index.search(scorerFor('compsoe'));

  expect(result.isFuzzy).toBe(true);
  expect(result.matchingLinksAndButtons.map(node => node.textContent)).toEqual(['Compose']);
});

test('ranks a closer spelling above a more distant one', async () => {
  document.body.innerHTML = '<button>Setting</button><button>Sitings</button>';
  index = new PageSearchIndex();

  const result = await index.search(scorerFor('settings'));

  expect(result.isFuzzy).toBe(true);
  expect(result.matchingLinksAndButtons.map(node => node.textContent)).toEqual([
    'Setting',
    'Sitings',
  ]);
});

test('never matches approximately for a query too short to be distinctive', async () => {
  document.body.innerHTML = '<p>Save</p>';
  index = new PageSearchIndex();

  // "sv" is one edit from "save", but too short to fuzzy match without dragging in noise.
  const result = await index.search(scorerFor('sv'));

  expect(result.isFuzzy).toBe(false);
  expect(result.matchingText).toEqual([]);
});

test('matches a word the query is only a mistyped prefix of', async () => {
  document.body.innerHTML = '<p>Contributing</p><a href="/c">Contributing guidelines</a>';
  index = new PageSearchIndex();

  // Exact search finds this from "contribu"; one typo later must not fall off a cliff.
  const exact = await index.search(scorerFor('contribu'));
  const fuzzy = await index.search(scorerFor('contribuu'));

  expect(exact.isFuzzy).toBe(false);
  expect(fuzzy.isFuzzy).toBe(true);
  // A typo should not change which parts of the page are found.
  expect(fuzzy.matchingText.map(match => match.node)).toEqual(
    exact.matchingText.map(match => match.node),
  );
  expect(fuzzy.matchingLinksAndButtons).toEqual(exact.matchingLinksAndButtons);
  // The term has to be present in the page for the highlight to land on it.
  for (const match of fuzzy.matchingText) {
    expect(match.node.textContent!.toLocaleLowerCase()).toContain(match.term);
  }
});

test('skips picker ranking below three characters without limiting navigation', async () => {
  document.body.innerHTML = '<p>Save</p>'.repeat(65);
  index = new PageSearchIndex();
  const result = await index.search(scorerFor('sa'));
  expect(result.matchingText).toHaveLength(65);
  expect(result.suggestions).toEqual([]);
});

test('ranks candidates with actions ahead of text', async () => {
  document.body.innerHTML = `
    <p>Save your work before leaving</p>
    <button>Save</button>
    <a href="/s">Save settings</a>`;
  index = new PageSearchIndex();

  const { suggestions } = await index.search(scorerFor('save'));

  expect(suggestions).toHaveLength(3);
  expect(suggestions[0]!.kind).toBe('action');
  expect(suggestions.map(entry => entry.node.textContent)).toContain(
    'Save your work before leaving',
  );
});

test('passes both kinds to shortlist selection without truncating candidates', async () => {
  document.body.innerHTML = `
    <button>Save</button><button>Save all</button><button>Save as</button>
    <p>Save your work before leaving</p>`;
  index = new PageSearchIndex();

  const { suggestions } = await index.search(scorerFor('save'));

  expect(suggestions.map(entry => entry.kind)).toEqual(['action', 'action', 'action', 'text']);
});

test('leaves a slate alone when only one kind of result exists', async () => {
  // Labelled with attributes only, so these are actions without also being text blocks.
  document.body.innerHTML =
    '<input aria-label="Save" /><input aria-label="Save all" /><input aria-label="Save as" />';
  index = new PageSearchIndex();

  const { suggestions } = await index.search(scorerFor('save'));

  expect(suggestions.map(entry => entry.kind)).toEqual(['action', 'action', 'action']);
});

test('ranks text for the slate by score, not by position on the page', async () => {
  // A strong match late on the page must also be reachable through navigation.
  // The filler only matches mid-word, so it never earns the boost for starting with the query.
  document.body.innerHTML = `${'<p>unsaved drafts</p>'.repeat(60)}<p>Save</p>`;
  index = new PageSearchIndex();

  const { suggestions, matchingText } = await index.search(scorerFor('save'));

  expect(suggestions[0]!.node.textContent).toBe('Save');
  expect(matchingText[60]!.node).toBe(suggestions[0]!.node);
  expect(suggestions).toHaveLength(61);
});

test('never gives one node two places in the slate', async () => {
  document.body.innerHTML = '<button>Save</button><p>Nothing else matches here</p>';
  index = new PageSearchIndex();

  const { suggestions } = await index.search(scorerFor('save'));

  const button = document.querySelector('button');
  expect(suggestions.filter(entry => entry.node === button)).toHaveLength(1);
});
