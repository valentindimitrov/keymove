import { KEYMOVE_ROOT_ID } from '../constants.js';
import createExtensionRoot from './create_extension_root.js';
import { removeStaleKeyMoveHosts, signKeyMoveHost } from './host_marker.js';

const SECRET = '0123456789abcdef0123456789abcdef';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async () => ({ hostMarkerSecret: '0123456789abcdef0123456789abcdef' })),
        set: vi.fn(async () => undefined),
      },
    },
  },
}));

// Extensions read closed roots through browser APIs that jsdom lacks; record them instead.
const closedRoots = new WeakMap<Element, ShadowRoot>();
const attachShadow = Element.prototype.attachShadow;
beforeAll(() => {
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
    this: Element,
    init: ShadowRootInit,
  ) {
    const root = attachShadow.call(this, init);
    closedRoots.set(this, root);
    return root;
  });
});
afterEach(() => {
  document.body.innerHTML = '';
});
const read = (element: Element) => closedRoots.get(element) ?? null;
const hosts = () => [...document.querySelectorAll(`#${KEYMOVE_ROOT_ID}`)];
const settle = () => new Promise(resolve => setTimeout(resolve));

/** A host left by an earlier copy whose script can no longer run: another module world. */
async function leftByPreviousCopy() {
  vi.resetModules();
  const previous = await import('./create_extension_root.js');
  const host = previous.default('', 'chrome').host;
  vi.resetModules();
  return host;
}

/** What page script can build: KeyMove's exact shape, with a marker it made up. */
function pageImpostor(secret: string, mode: ShadowRootMode = 'closed') {
  const host = document.createElement('div');
  host.id = KEYMOVE_ROOT_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<style></style><div id="keymove-app"></div><div id="keymove-portal"></div>';
  const marker = document.createElement('span');
  marker.attachShadow({ mode }).innerHTML = `<span data-keymove-secret="${secret}"></span>`;
  shadow.append(marker);
  document.body.append(host);
  return host;
}

test('removes a host signed by an earlier copy of this extension, never the current one', async () => {
  const stale = await leftByPreviousCopy();
  const current = createExtensionRoot('', 'chrome').host;
  await settle();
  expect(hosts()).toEqual([stale, current]);
  expect(removeStaleKeyMoveHosts(SECRET, read)).toBe(1);
  expect(hosts()).toEqual([current]);
});

test('removes a stale host that had moved into a modal inside an open shadow root', async () => {
  const stale = await leftByPreviousCopy();
  await settle();
  const component = document.createElement('checkout-dialog');
  document.body.append(component);
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  component.attachShadow({ mode: 'open' }).append(dialog);
  dialog.append(stale);
  expect(removeStaleKeyMoveHosts(SECRET, read)).toBe(1);
  expect(stale.isConnected).toBe(false);
});

test('keeps page elements, whatever shape or marker they copy', async () => {
  const guessed = pageImpostor('f'.repeat(32));
  const open = pageImpostor('0'.repeat(32), 'open');
  const plain = document.createElement('div');
  plain.id = KEYMOVE_ROOT_ID;
  document.body.append(plain);
  await settle();
  expect(removeStaleKeyMoveHosts(SECRET, read)).toBe(0);
  expect(hosts()).toEqual([guessed, open, plain]);
});

test('keeps a stale host that page script put its own content into', async () => {
  const stale = await leftByPreviousCopy();
  await settle();
  stale.append(document.createElement('p'));
  expect(removeStaleKeyMoveHosts(SECRET, read)).toBe(0);
  expect(hosts()).toEqual([stale]);
});

test('the signature is unreadable from the open shadow root a page can reach', async () => {
  const host = createExtensionRoot('', 'chrome').host;
  await settle();
  expect(host.shadowRoot?.innerHTML).not.toContain(SECRET);
  for (const child of host.shadowRoot!.children) expect(child.shadowRoot).toBeNull();
});

test('a frame overlay signed by an earlier copy is removed too', async () => {
  const overlay = document.createElement('div');
  overlay.id = KEYMOVE_ROOT_ID;
  signKeyMoveHost(overlay.attachShadow({ mode: 'open' }));
  document.documentElement.append(overlay);
  await settle();
  expect(removeStaleKeyMoveHosts(SECRET, read)).toBe(1);
  expect(overlay.isConnected).toBe(false);
});

test('reads the closed root through the property Firefox gives content scripts', async () => {
  // Firefox exposes `element.openOrClosedShadowRoot` as a read-only property, not a method.
  Object.defineProperty(Element.prototype, 'openOrClosedShadowRoot', {
    configurable: true,
    get(this: Element) {
      return closedRoots.get(this) ?? this.shadowRoot;
    },
  });
  try {
    const stale = await leftByPreviousCopy();
    const current = createExtensionRoot('', 'chrome').host;
    await settle();
    expect(hosts()).toEqual([stale, current]);
    expect(removeStaleKeyMoveHosts(SECRET)).toBe(1);
    expect(hosts()).toEqual([current]);
  } finally {
    Reflect.deleteProperty(Element.prototype, 'openOrClosedShadowRoot');
  }
});
