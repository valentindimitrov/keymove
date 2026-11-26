import NodeScorer from './node_scorer.js';
import { PageSearchIndex } from './page_search_index.js';
import { markKeyMoveRoot } from './dom_tree.js';
import { highlightRangesForMatches } from '../hooks/use_highlights.js';

let index: PageSearchIndex | null = null;

function scorerFor(query: string) {
  return new NodeScorer(query);
}

function waitForMutations() {
  return new Promise<void>(resolve => window.setTimeout(resolve, 0));
}

test.each([
  ['Account     settings', 'account settings', 'Account     settings', false],
  ['Account \n <strong>  settings</strong>', 'account settings', 'Account \n   settings', false],
  ['Account<br>settings', 'account settings', 'Accountsettings', false],
  [
    'Account<span style="display:block">settings</span>',
    'account settings',
    'Accountsettings',
    false,
  ],
  ['Account     settings', 'account settongs', 'Account     settings', true],
  ['Cafe<span>\u0301</span>', 'café', 'Cafe\u0301', false],
  ['Настройки', 'настройки', 'Настройки', false],
  ['ΕΛΛΑΣ', 'ελλασ', 'ΕΛΛΑΣ', false],
  ['日本語検索', '日本語', '日本語', false],
  ['مرحبا بالعالم', 'مرحبا', 'مرحبا', false],
  ['𐐀𐐁𐐂', '𐐨𐐩𐐪', '𐐀𐐁𐐂', false],
  ['İ Account     settings', 'account settings', 'Account     settings', false],
])('search and highlighting agree for %s / %s', async (html, query, expectedRange, fuzzy) => {
  document.body.innerHTML = `<p>${html}</p>`;
  index = new PageSearchIndex();
  const result = await index.search(scorerFor(query));
  expect(result.isFuzzy).toBe(fuzzy);
  expect(result.matchingText).toHaveLength(1);
  expect(highlightRangesForMatches(result.matchingText).map(range => range.toString())).toEqual([
    expectedRange,
  ]);
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

afterEach(() => {
  if (index) {
    index.disconnect();
    index = null;
  }
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
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
  const host = document.createElement('div');
  markKeyMoveRoot(host);
  document.body.append(host);
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

test('ranks short queries without limiting navigation', async () => {
  document.body.innerHTML = '<p>Save</p>'.repeat(65);
  index = new PageSearchIndex();
  const result = await index.search(scorerFor('sa'));
  expect(result.matchingText).toHaveLength(65);
  expect(result.suggestions).toHaveLength(65);
});

test('ranks an action ahead of a slightly stronger text match', async () => {
  // The text matches mid-word (score 1); the action matches only through its label, which
  // scores 0.9. The action priority boost alone puts the action first.
  document.body.innerHTML = '<p>Autosave drafts</p><input aria-label="Autosave" />';
  index = new PageSearchIndex();

  const { suggestions } = await index.search(scorerFor('save'));

  expect(suggestions.map(entry => entry.kind)).toEqual(['action', 'text']);
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

describe('text owned by a node', () => {
  // EDGAR filings open with unclosed SGML header tags, so the parser nests the whole
  // filing inside elements that also hold a few characters of their own.
  const edgarHeader =
    '<DOCUMENT><TYPE>S-1/A<SEQUENCE>1<FILENAME>filing.htm<DESCRIPTION>S-1/A' +
    '<div><p>Total revenue grew</p><div><font>Our revenue in 2025</font></div>' +
    '<div><a href="#notes">See revenue notes</a></div></div>';

  test.each(['revenue', 'revenoe'])('never selects an EDGAR header wrapper for %s', async query => {
    document.body.innerHTML = edgarHeader;
    index = new PageSearchIndex();
    const result = await index.search(scorerFor(query));
    expect(result.isFuzzy).toBe(query === 'revenoe');
    expect(result.matchingText.map(match => match.node)).toEqual([
      document.querySelector('p'),
      document.querySelector('font'),
      document.querySelector('a'),
    ]);
    expect(result.matchingLinksAndButtons).toEqual([document.querySelector('a')]);
  });

  test('still finds the text a header wrapper holds itself', async () => {
    document.body.innerHTML = edgarHeader;
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('filing.htm'));
    expect(result.matchingText.map(match => match.node)).toContain(
      document.querySelector('filename'),
    );
  });

  test('ignores stray wrapper text when the match is in a nested block', async () => {
    document.body.innerHTML = '<div id="outer">stray text <div id="inner">the revenue</div></div>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('revenue'));
    expect(result.matchingText.map(match => match.node)).toEqual([
      document.getElementById('inner'),
    ]);
  });

  test('treats a descendant styled as a block as its own block', async () => {
    document.body.innerHTML =
      '<div id="outer">Intro <span id="inner" style="display:block">revenue</span></div>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('revenue'));
    expect(result.matchingText.map(match => match.node)).toEqual([
      document.getElementById('inner'),
    ]);
  });

  test('keeps inline descendants as part of the block that holds them', async () => {
    document.body.innerHTML = '<div id="outer">Total <b>revenue</b> grew</div>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('total revenue grew'));
    expect(result.matchingText).toMatchObject([
      { node: document.getElementById('outer'), term: 'total revenue grew' },
    ]);
  });

  test('keeps nested list items from repeating their parent item', async () => {
    document.body.innerHTML =
      '<ul><li id="outer">Outer<ul><li id="inner">revenue</li></ul></li></ul>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('revenue'));
    expect(result.matchingText.map(match => match.node)).toEqual([
      document.getElementById('inner'),
    ]);
  });

  test('finds a phrase in a nested block that has no text node of its own', async () => {
    document.body.innerHTML =
      '<div>Intro <div id="inner"><span>Total </span><b>revenue</b></div></div>';
    index = new PageSearchIndex();
    for (const query of ['total revenue', 'total revenoe']) {
      const result = await index.search(scorerFor(query));
      expect(result.matchingText.map(match => match.node)).toEqual([
        document.getElementById('inner'),
      ]);
    }
    // A word one inline child holds is that child's result, not the block's as well.
    expect(
      (await index.search(scorerFor('revenue'))).matchingText.map(match => match.node),
    ).toEqual([document.querySelector('b')]);
  });

  test('finds a phrase in a standalone block that no candidate contains', async () => {
    document.body.innerHTML =
      '<section><div id="block"><span>Free </span><b>shipping</b></div></section>' +
      '<div id="links"><span>Save </span><a href="#b">settings</a></div>';
    index = new PageSearchIndex();
    for (const [query, id] of [
      ['free shipping', 'block'],
      ['free shippong', 'block'],
      ['save settings', 'links'],
    ]) {
      const result = await index.search(scorerFor(query!));
      expect(result.matchingText.map(match => match.node)).toEqual([document.getElementById(id!)]);
    }
    // A word one inline child holds is still that child's result alone.
    expect(
      (await index.search(scorerFor('shipping'))).matchingText.map(match => match.node),
    ).toEqual([document.querySelector('b')]);
  });

  test('never makes the page root a result for inline phrases directly inside it', async () => {
    document.body.innerHTML =
      '<span>Free </span><b>shipping</b><main><a href="/account">Account</a></main>';
    index = new PageSearchIndex();
    expect((await index.search(scorerFor('free shipping'))).matchingText).toEqual([]);
  });

  test.each([
    ['<span style="display: contents">Free <b>shipping</b></span>'],
    ['<span style="display: contents">Free </span><span style="display: contents">shipping</span>'],
  ])('finds a phrase through wrappers laid out with display: contents: %s', async html => {
    document.body.innerHTML = `<section><div id="block">${html}</div></section>`;
    // Browsers give a display: contents element no box of its own; jsdom has no layout.
    for (const wrapper of document.querySelectorAll('span')) {
      Object.defineProperty(wrapper, 'offsetWidth', { value: 0 });
      Object.defineProperty(wrapper, 'offsetHeight', { value: 0 });
      wrapper.getClientRects = () => ({ length: 0 }) as DOMRectList;
    }
    index = new PageSearchIndex();
    expect(
      (await index.search(scorerFor('free shipping'))).matchingText.map(match => match.node),
    ).toEqual([document.getElementById('block')]);
  });

  test('never queues a block for text that is out of scope', async () => {
    document.body.innerHTML =
      '<section><div><span inert>Archive project</span><button>Delete</button></div></section>';
    index = new PageSearchIndex();
    expect((await index.search(scorerFor('archive project'))).matchingText).toEqual([]);
  });

  test('never attaches an action from a box the result does not own', async () => {
    document.body.innerHTML =
      '<section><div id="block"><span>Free </span><b>shipping</b> <a href="#terms">terms</a>' +
      '<aside><button>Delete account</button></aside></div></section>' +
      '<section><div id="other"><span>Gift </span><b>wrap</b>' +
      '<aside><button>Delete account</button></aside></div></section>';
    index = new PageSearchIndex();
    expect((await index.search(scorerFor('free shipping'))).matchingText).toMatchObject([
      { node: document.getElementById('block'), action: document.querySelector('a') },
    ]);
    expect((await index.search(scorerFor('gift wrap'))).matchingText).toMatchObject([
      { node: document.getElementById('other'), action: null },
    ]);
  });

  test('keeps a block whose own phrase is separate from a matching nested block', async () => {
    document.body.innerHTML =
      '<div>Intro <div id="own"><span>Total </span><b>revenue</b>' +
      '<p id="nested">Total revenue</p></div></div>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('total revenue'));
    expect(result.matchingText.map(match => match.node)).toEqual([
      document.getElementById('own'),
      document.getElementById('nested'),
    ]);
  });

  test('keeps a block holding an occurrence that none of its inline results holds', async () => {
    document.body.innerHTML =
      '<div>Intro<div id="own"><span>Total </span><b>revenue</b>' +
      '<div>unrelated text</div><i id="child">Total revenue</i></div></div>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('total revenue'));
    expect(result.matchingText.map(match => match.node)).toEqual([
      document.getElementById('own'),
      document.getElementById('child'),
    ]);
  });

  test('counts overlapping occurrences before dropping a block', async () => {
    document.body.innerHTML =
      '<div>Intro<div id="own"><span>ban</span><b id="child">ana</b></div></div>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('ana'));
    expect(result.matchingText.map(match => match.node)).toEqual([
      document.getElementById('own'),
      document.getElementById('child'),
    ]);
  });

  test('finds a block indexed before the wrapper that leaves it out', async () => {
    document.body.innerHTML =
      '<div id="outer"><a href="#" style="display:block"><span>Total </span><b>revenue</b></a></div>';
    index = new PageSearchIndex();
    await index.search(scorerFor('total revenue'));
    document.getElementById('outer')!.prepend('Intro');
    await Promise.resolve();
    const link = document.querySelector('a');
    for (const query of ['total revenue', 'total revenoe']) {
      const result = await index.search(scorerFor(query));
      expect(result.matchingText.map(match => match.node)).toEqual([link]);
      expect(result.matchingLinksAndButtons).toEqual([link]);
    }
  });

  test('stops deciding held-back block results once the search is cancelled', async () => {
    document.body.innerHTML = `<div>Intro${'<div><span>Total </span><b>revenue</b></div>'.repeat(50)}</div>`;
    index = new PageSearchIndex();
    const controller = new AbortController();
    const internals = index as unknown as {
      collectTextMatch: (
        node: Element,
        match: unknown,
        collector: { deferredText: unknown },
      ) => void;
    };
    const collect = internals.collectTextMatch.bind(index);
    let decided = 0;
    internals.collectTextMatch = (node, match, collector) => {
      if (collector.deferredText === null) {
        decided += 1;
        controller.abort();
      }
      collect(node, match, collector);
    };
    await expect(
      index.search(scorerFor('total revenue'), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(decided).toBe(1);
  });

  test('gives the same results as a new index after the page changes', async () => {
    document.body.innerHTML =
      '<div id="outer">Intro<div id="own"><span>Total </span><b>revenue</b></div></div>';
    index = new PageSearchIndex();
    expect((await index.search(scorerFor('total revenue'))).matchingText).toHaveLength(1);
    document.getElementById('outer')!.firstChild!.remove();
    await Promise.resolve();
    const later = await index.search(scorerFor('total revenue'));
    index.disconnect();
    index = new PageSearchIndex();
    const fresh = await index.search(scorerFor('total revenue'));
    expect(later.matchingText.map(match => match.node)).toEqual(
      fresh.matchingText.map(match => match.node),
    );
  });

  test('reads slotted text through a slot styled as a block', async () => {
    document.body.innerHTML = '<x-report>revenue</x-report>';
    const host = document.querySelector('x-report')!;
    host.attachShadow({ mode: 'open' }).innerHTML = '<slot style="display:block"></slot>';
    index = new PageSearchIndex();
    const result = await index.search(scorerFor('revenue'));
    expect(result.matchingText.map(match => match.node)).toEqual([host]);
  });

  test('never joins the text on either side of a nested block into one phrase', async () => {
    document.body.innerHTML = '<div id="outer">Total<div>unrelated text</div>revenue</div>';
    index = new PageSearchIndex();
    expect((await index.search(scorerFor('total revenue'))).matchingText).toEqual([]);
    const fuzzy = await index.search(scorerFor('total revenoe'));
    expect(fuzzy.matchingText).toEqual([]);
  });

  test('matches an action by all of its text while text results stay in their blocks', async () => {
    document.body.innerHTML = '<a href="#report">Read <div id="title">revenue report</div></a>';
    index = new PageSearchIndex();
    const link = document.querySelector('a')!;
    const result = await index.search(scorerFor('read revenue'));
    expect(result.matchingLinksAndButtons).toEqual([link]);
    expect(result.matchingText).toEqual([]);
    const byTitle = await index.search(scorerFor('revenue'));
    expect(byTitle.matchingLinksAndButtons).toEqual([link]);
    expect(byTitle.matchingText).toMatchObject([
      { node: document.getElementById('title'), action: link },
    ]);
  });
});
