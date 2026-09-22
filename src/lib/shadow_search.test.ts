import { PageSearchIndex } from './page_search_index.js';
import NodeScorer from './node_scorer.js';
import { visibleText } from './visible_text.js';
import { highlightRangesForMatches } from '../hooks/use_highlights.js';
import { kindLabelForNode } from './suggestion_context.js';
import { activeModal, actionIsInScope } from './modal_context.js';
import Utils from './utils.js';
import createExtensionRoot, { keepExtensionRootConnected } from './create_extension_root.js';
import { pageShadowRoots } from './dom_tree.js';

let index: PageSearchIndex | undefined;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function component(html: string, parent: Node = document.body) {
  const host = document.createElement('test-component');
  parent.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = html;
  return { host, root };
}
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20);
});
afterEach(() => {
  index?.disconnect();
  index = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('finds nested shadow text in page order, maps highlights and activates its action', async () => {
  document.body.innerHTML = '<p id="before">Orbit before</p>';
  const { root } = component('<p id="middle">Orbit <b>middle</b> <button>Launch</button></p>');
  const nested = component('<p id="nested">Orbit nested</p>', root);
  document.body.insertAdjacentHTML('beforeend', '<p id="after">Orbit after</p>');
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('orbit'));
  expect(result.matchingText.map(match => match.node.id)).toEqual([
    'before',
    'middle',
    'nested',
    'after',
  ]);
  expect(highlightRangesForMatches(result.matchingText).map(range => range.toString())).toEqual([
    'Orbit',
    'Orbit',
    'Orbit',
    'Orbit',
  ]);
  const click = vi.fn();
  root.querySelector('button')!.addEventListener('click', click);
  Utils.clickOrFocusNode(result.matchingText[1]!.action!);
  expect(click).toHaveBeenCalledOnce();
  expect(visibleText(nested.root.querySelector('p')!)).toBe('Orbit nested');
});

test('resolves IDs within each tree, handles labelled controls and noncomposed changes', async () => {
  document.body.innerHTML = '<span id="name">Wrong outer name</span>';
  const { root } = component(
    '<span id="name" hidden>Delivery</span><input aria-labelledby="name"><label>Digest<input type="checkbox" style="opacity:0"></label>',
  );
  const changed = vi.fn();
  index = new PageSearchIndex(changed);
  expect((await index.search(new NodeScorer('delivery'))).matchingLinksAndButtons).toEqual([
    root.querySelector('input'),
  ]);
  const check = root.querySelector<HTMLInputElement>('[type=checkbox]')!;
  const result = await index.search(new NodeScorer('digest'));
  expect(result.matchingLinksAndButtons).toEqual([root.querySelector('label')]);
  changed.mockClear();
  check.checked = true;
  check.dispatchEvent(new Event('change', { bubbles: true }));
  expect(changed).toHaveBeenCalledOnce();
  expect(kindLabelForNode(result.matchingLinksAndButtons[0]!, 'action')).toBe('checkbox · checked');
  root.querySelector('#name')!.textContent = 'Shipping';
  await tick();
  expect((await index.search(new NodeScorer('shipping'))).matchingLinksAndButtons).toEqual([
    root.querySelector('input'),
  ]);
});

test('excludes hidden hosts, unslotted light DOM, replaced fallback, closed roots and KeyMove UI', async () => {
  const { host, root } = component(
    '<p>Visible nebula</p><slot name="caption"><p>Fallback nebula</p></slot>',
  );
  host.innerHTML = '<span slot="caption">Slotted nebula</span><p>Unassigned nebula</p>';
  component('<p>Hidden nebula</p>').host.hidden = true;
  const closed = document.createElement('div');
  document.body.append(closed);
  closed.attachShadow({ mode: 'closed' }).innerHTML = '<p>Closed nebula</p>';
  const extension = component('<p>KeyMove nebula</p>');
  extension.host.id = 'keymove-root';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('nebula'));
  expect(result.matchingText.map(match => visibleText(match.node))).toEqual([
    'Visible nebula',
    'Slotted nebula',
  ]);
  host.style.display = 'none';
  await tick();
  expect((await index.search(new NodeScorer('nebula'))).matchingText).toEqual([]);
  expect(root.querySelector('slot')).not.toBeNull();
});

test('refreshes mutations and inserted roots, prunes removed roots and discovers late attachment on next search', async () => {
  const first = component('<p>Original comet</p>');
  const late = document.createElement('div');
  document.body.append(late);
  const changed = vi.fn();
  index = new PageSearchIndex(changed);
  await index.search(new NodeScorer('comet'));
  first.root.querySelector('p')!.textContent = 'Updated comet';
  await tick();
  expect(changed).toHaveBeenCalled();
  expect((await index.search(new NodeScorer('updated'))).matchingText).toHaveLength(1);
  const added = component('<p>Inserted comet</p>', first.root);
  await tick();
  expect((await index.search(new NodeScorer('inserted'))).matchingText[0]?.node).toBe(
    added.root.querySelector('p'),
  );
  late.attachShadow({ mode: 'open' }).innerHTML = '<p>Late comet</p>';
  expect((await index.search(new NodeScorer('late'))).matchingText).toHaveLength(1);
  first.host.remove();
  await tick();
  expect(
    (await index.search(new NodeScorer('comet'))).matchingText.map(match =>
      visibleText(match.node),
    ),
  ).toEqual(['Late comet']);
  index.disconnect();
  changed.mockClear();
  late.shadowRoot!.querySelector('p')!.textContent = 'Disconnected comet';
  await tick();
  expect(changed).not.toHaveBeenCalled();
});

test('keeps shadow actions within light and shadow modal boundaries and respects inert hosts', async () => {
  document.body.innerHTML = '<section role="dialog" aria-modal="true" id="outer"></section>';
  const inner = component('<button>Modal save</button>', document.querySelector('section')!);
  index = new PageSearchIndex();
  expect((await index.search(new NodeScorer('save'))).matchingLinksAndButtons).toEqual([
    inner.root.querySelector('button'),
  ]);
  inner.root.innerHTML =
    '<section role="dialog" aria-modal="true"><button>Nested save</button></section>';
  await tick();
  await index.search(new NodeScorer('save'));
  expect(activeModal()).toBe(inner.root.querySelector('section'));
  inner.host.inert = true;
  inner.host.setAttribute('inert', '');
  expect(
    actionIsInScope(inner.root.querySelector('button')!, document.querySelector('section')),
  ).toBe(false);
});

test('searches composed slot text once and splits cross-root highlights without losing offsets', async () => {
  const { host, root } = component('<p id="caption">Bright <slot></slot> ahead</p>');
  host.innerHTML = '<b>comet</b>';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('bright comet ahead'));
  expect(result.matchingText.map(match => match.node)).toEqual([root.querySelector('p')]);
  expect(visibleText(result.matchingText[0]!.node)).toBe('Bright comet ahead');
  expect(highlightRangesForMatches(result.matchingText).map(range => range.toString())).toEqual([
    'Bright ',
    'comet',
    ' ahead',
  ]);
});

test('finds direct shadow text and a slot-only button label without duplicate text results', async () => {
  component('Direct nebula');
  const { host, root } = component('<button><slot></slot></button>');
  host.textContent = 'Launch nebula';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('nebula'));
  expect(result.matchingText.map(match => visibleText(match.node))).toEqual([
    'Direct nebula',
    'Launch nebula',
  ]);
  expect(result.matchingLinksAndButtons).toEqual([root.querySelector('button')]);
});

test('highlights slot-assigned nodes in rendered order even when their DOM order is reversed', async () => {
  const { host } = component('<p><slot name="first"></slot><slot name="last"></slot></p>');
  host.innerHTML = '<span slot="last">tail</span><span slot="first">head </span>';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('head tail'));
  expect(result.matchingText).toHaveLength(1);
  expect(highlightRangesForMatches(result.matchingText).map(range => range.toString())).toEqual([
    'head ',
    'tail',
  ]);
});

test('attaches the first rendered slotted action to a matching text block', async () => {
  const { host, root } = component(
    '<p>Unique caption <slot name="first"><button>Fallback</button></slot><slot name="last"></slot></p>',
  );
  host.innerHTML = '<button slot="last">Later action</button><button slot="first">Launch</button>';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('unique caption'));
  expect(result.matchingText).toHaveLength(1);
  expect(result.matchingText[0]!.action).toBe(host.querySelector('[slot="first"]'));
  const click = vi.fn();
  host.querySelector('[slot="first"]')!.addEventListener('click', click);
  Utils.clickOrFocusNode(result.matchingText[0]!.action!);
  expect(click).toHaveBeenCalledOnce();
  expect(result.matchingText[0]!.node).toBe(root.querySelector('p'));
});

test('names a shadow button from its assigned image without using replaced or unslotted images', async () => {
  const { host, root } = component(
    '<button><slot name="icon"><img alt="Fallback picture"></slot></button>',
  );
  host.innerHTML = '<img slot="icon" alt="Launch rocket"><img alt="Unassigned picture">';
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('launch rocket'));
  expect(result.matchingLinksAndButtons).toEqual([root.querySelector('button')]);
  expect(result.matchingText).toEqual([]);
  expect((await index.search(new NodeScorer('picture'))).matchingLinksAndButtons).toEqual([]);
});

test('cold indexing visits nested shadow content a bounded number of times', async () => {
  let parent: Node = document.body;
  for (let i = 0; i < 20; i++) parent = component('', parent).root;
  const leaf = document.createElement('p');
  leaf.textContent = 'Comet';
  parent.appendChild(leaf);
  index = new PageSearchIndex();
  const refresh = vi.spyOn(index, 'refreshCandidate');
  const result = await index.search(new NodeScorer('comet'));
  expect(result.matchingText.map(match => match.node)).toEqual([leaf]);
  // Discovery and the queued indexing pass may each visit once, regardless of depth.
  expect(refresh.mock.calls.filter(([node]) => node === leaf).length).toBeLessThanOrEqual(2);
});

test('keeps a shadow modal mounted after the search index is released, then removes disconnected observers', async () => {
  const { host, root } = component(
    '<section role="dialog" aria-modal="false"><button>Save</button></section>',
  );
  const extension = createExtensionRoot('')!;
  const mount = keepExtensionRootConnected(extension.host);
  try {
    index = new PageSearchIndex();
    await index.search(new NodeScorer('save'));
    root.querySelector('section')!.setAttribute('aria-modal', 'true');
    await tick();
    expect(extension.host.parentElement).toBe(root.querySelector('section'));
    index.disconnect();
    index = undefined;
    expect(extension.host.parentElement).toBe(root.querySelector('section'));
    expect(createExtensionRoot('')).toBeNull();
    host.remove();
    await tick();
    expect(extension.host.parentElement).toBe(document.body);
    expect(pageShadowRoots()).not.toContain(root);
  } finally {
    mount.disconnect();
  }
});

test('discovers the focused component modal before any search', () => {
  const { root } = component('<section role="dialog" aria-modal="true"><input></section>');
  root.querySelector('input')!.focus();
  const extension = createExtensionRoot('')!;
  const mount = keepExtensionRootConnected(extension.host);
  try {
    expect(extension.host.parentElement).toBe(root.querySelector('section'));
  } finally {
    mount.disconnect();
  }
});

test('cancels shadow discovery and releases partially discovered roots and their listeners', async () => {
  const { root } = component('<p>Comet</p>'.repeat(250));
  vi.useFakeTimers();
  let elapsed = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => {
    elapsed += 8;
    return elapsed;
  });
  const changed = vi.fn();
  index = new PageSearchIndex(changed);
  try {
    const controller = new AbortController();
    const pending = index.search(new NodeScorer('comet'), { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(pageShadowRoots()).toContain(root);
    controller.abort();
    await rejected;
    index.disconnect();
    expect(pageShadowRoots()).not.toContain(root);
    changed.mockClear();
    root.querySelector('p')!.textContent = 'Changed';
    root.dispatchEvent(new Event('slotchange'));
    await vi.runAllTimersAsync();
    expect(changed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
