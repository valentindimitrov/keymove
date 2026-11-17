import createExtensionRoot from './create_extension_root.js';
import { isKeyMoveNode, releasePageRoot, retainPageRoot, walkOwnedElements } from './dom_tree.js';
import NodeScorer from './node_scorer.js';
import { PageSearchIndex } from './page_search_index.js';
import { visibleText } from './visible_text.js';
import Utils from './utils.js';

// Page script can give any element KeyMove's ids. Only the elements KeyMove itself
// created may count as KeyMove; an impostor stays ordinary page content.

let index: PageSearchIndex | null = null;
beforeAll(() => {
  // jsdom has no layout; the index treats zero-sized elements as hidden.
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
  index?.disconnect();
  index = null;
  document.body.innerHTML = '';
});

test('a page element with the root id neither blocks mounting nor counts as KeyMove', () => {
  document.body.innerHTML = '<div id="keymove-root"><p>Impostor zebra</p></div>';
  const impostor = document.querySelector('p')!;
  const extension = createExtensionRoot('');
  expect(extension).not.toBeNull();
  expect(extension!.host.isConnected).toBe(true);
  expect(isKeyMoveNode(impostor)).toBe(false);
  expect(isKeyMoveNode(extension!.app)).toBe(true);
  expect(isKeyMoveNode(extension!.host)).toBe(true);
  expect([...walkOwnedElements(document.body)]).toContain(impostor);
  expect([...walkOwnedElements(document.body)]).not.toContain(extension!.host);
});

test('a root id inside an open page shadow root does not block mounting', () => {
  const component = document.createElement('div');
  document.body.append(component);
  const shadow = component.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<div id="keymove-root"></div>';
  // A search discovers and retains open roots; mounting used to look inside them.
  retainPageRoot(shadow);
  try {
    expect(createExtensionRoot('')).not.toBeNull();
  } finally {
    releasePageRoot(shadow);
  }
});

test('page elements with KeyMove interface ids are not treated as KeyMove UI', () => {
  document.body.innerHTML =
    '<div id="keymove-container"><button>Page</button></div><div id="keymove-portal"><a href="#x">Link</a></div>';
  expect(Utils.isExtensionElement(document.querySelector('button'))).toBe(false);
  expect(Utils.isExtensionElement(document.querySelector('a'))).toBe(false);
  const extension = createExtensionRoot('')!;
  const own = document.createElement('button');
  extension.portal.append(own);
  expect(Utils.isExtensionElement(own)).toBe(true);
  expect(Utils.isExtensionElement(extension.host)).toBe(true);
});

test('text inside a page impostor is searchable while the real host is not', async () => {
  document.body.innerHTML = '<div id="keymove-root"><p>Impostor zebra</p></div>';
  const extension = createExtensionRoot('')!;
  const own = document.createElement('p');
  own.textContent = 'KeyMove zebra';
  extension.app.append(own);
  index = new PageSearchIndex();
  const result = await index.search(new NodeScorer('zebra'));
  expect(result.matchingText.map(match => visibleText(match.node))).toEqual(['Impostor zebra']);
});
