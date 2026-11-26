import Utils from './utils.js';
import { setFrameTarget } from './frame_target.js';
import type { FrameCommand } from './frame_protocol.js';

// Extension-only access to closed roots, as `dom.openOrClosedShadowRoot` gives in Chromium.
const closedRoots = vi.hoisted(() => new WeakMap<Element, ShadowRoot>());
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { id: 'test' },
    dom: { openOrClosedShadowRoot: (element: Element) => closedRoots.get(element) ?? null },
  },
}));

test.each(['é', 'Б', 'λ', '日', 'ع', '𐐀', '१'])('accepts %s to start searching', key => {
  expect(Utils.keyValidForFocus(key)).toBe(true);
});

test.each(['Dead', 'Process', 'Enter', ' ', '😀'])(
  'does not capture the non-search key %s',
  key => {
    expect(Utils.keyValidForFocus(key)).toBe(false);
  },
);

test.each([
  ['below the viewport', 900, 940, 'center'],
  ['partly below the viewport', 780, 820, 'center'],
  ['above the viewport', -100, -60, 'center'],
  ['just inside the bottom edge', 740, 780, 'center'],
  ['just inside the top edge', 20, 60, 'center'],
  ['already visible', 200, 240, 'nearest'],
])('scrolls a match %s with room for context', (_label, top, bottom, block) => {
  vi.stubGlobal('innerHeight', 800);
  const node = document.createElement('p');
  node.scrollIntoView = vi.fn();
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
  try {
    Utils.scrollToNodeAtIndexInList([node], 0);
    expect(node.scrollIntoView).toHaveBeenCalledWith({ block, inline: 'nearest' });
  } finally {
    vi.unstubAllGlobals();
  }
});

afterEach(() => {
  Utils.clearPageSelection();
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

test('tracks the active input through a shadow root', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  shadowRoot.appendChild(input);
  document.body.appendChild(host);

  input.focus();

  expect(Utils.elementIsActive(input)).toBe(true);
  expect(Utils.differentInputIsActive(input)).toBe(false);
});

function closedHost(tag: string, init: Partial<ShadowRootInit> = {}) {
  const host = document.createElement(tag);
  const shadowRoot = host.attachShadow({ mode: 'closed', ...init });
  closedRoots.set(host, shadowRoot);
  document.body.appendChild(host);
  return { host, shadowRoot };
}

test('tracks the active editor through a closed shadow root', () => {
  const { host, shadowRoot } = closedHost('rich-editor');
  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', 'true');
  // jsdom computes no isContentEditable.
  Object.defineProperty(editor, 'isContentEditable', { value: true });
  shadowRoot.appendChild(editor);

  editor.focus();

  expect(Utils.elementIsActive(editor)).toBe(true);
  expect(Utils.differentInputIsActive(null)).toBe(true);
  host.remove();
});

test('keeps a focused host widget role protecting keys typed inside it', () => {
  const { host, shadowRoot } = closedHost('fruit-list');
  host.setAttribute('role', 'listbox');
  const option = document.createElement('div');
  option.setAttribute('role', 'option');
  option.tabIndex = 0;
  shadowRoot.appendChild(option);

  option.focus();

  expect(Utils.differentInputIsActive(null)).toBe(true);
  host.remove();
});

test('lets a non-editable control inside an editable host start a search', () => {
  const { host, shadowRoot } = closedHost('rich-editor');
  Object.defineProperty(host, 'isContentEditable', { value: true });
  const bold = document.createElement('button');
  shadowRoot.appendChild(bold);

  bold.focus();

  expect(Utils.differentInputIsActive(null)).toBe(false);
  host.remove();
});

test('counts a host that delegates focus as active', () => {
  const { host, shadowRoot } = closedHost('text-field', { delegatesFocus: true });
  const input = document.createElement('input');
  shadowRoot.appendChild(input);

  input.focus();

  expect(Utils.elementIsActive(host)).toBe(true);
  expect(Utils.elementIsActive(input)).toBe(true);
  host.remove();
});

test('recognizes a host-page input as a different active input', () => {
  const keyMoveInput = document.createElement('input');
  const pageInput = document.createElement('textarea');
  document.body.append(keyMoveInput, pageInput);

  pageInput.focus();

  expect(Utils.differentInputIsActive(keyMoveInput)).toBe(true);
});

test('selects and clears all contents of a text block', () => {
  const paragraph = document.createElement('p');
  paragraph.innerHTML = 'Read the <a href="/docs">documentation</a> now.';
  document.body.append(paragraph);

  Utils.selectNodeContents(paragraph);
  expect(window.getSelection()?.toString()).toBe('Read the documentation now.');

  Utils.clearPageSelection();
  expect(window.getSelection()?.rangeCount).toBe(0);
});

test('restores the original query caret after selecting multiple page blocks', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const input = document.createElement('input');
  input.value = 'save';
  shadow.append(input);
  const first = document.createElement('p');
  first.textContent = 'Save first';
  const second = document.createElement('p');
  second.textContent = 'Save second';
  document.body.append(host, first, second);
  input.focus();
  input.setSelectionRange(2, 2);
  Utils.selectNodeContents(first);
  // jsdom does not model the browser moving the input's internal caret during page selection.
  input.setSelectionRange(0, 0);
  Utils.selectNodeContents(second);
  expect(window.getSelection()?.toString()).toBe('Save second');
  Utils.restoreInputSelection(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2]);
  expect(window.getSelection()?.rangeCount).toBe(0);
});

test('leaves a user-created selection alone when clearing search selection', () => {
  const first = document.createElement('p');
  first.textContent = 'Search result';
  const second = document.createElement('p');
  second.textContent = 'User selection';
  document.body.append(first, second);
  Utils.selectNodeContents(first);
  const userRange = document.createRange();
  userRange.selectNodeContents(second);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(userRange);
  Utils.clearPageSelection();
  expect(selection.toString()).toBe('User selection');
});

test('resolves safe anchor destinations for link actions', () => {
  const link = document.createElement('a');
  link.href = '/docs';
  const button = document.createElement('button');

  expect(Utils.linkUrlForNode(link)).toBe('http://localhost:3000/docs');
  expect(Utils.openableLinkUrlForNode(link)).toBe('http://localhost:3000/docs');
  expect(Utils.linkUrlForNode(button)).toBeNull();
  expect(Utils.openableLinkUrlForNode(button)).toBeNull();

  link.href = 'mailto:test@example.com';
  expect(Utils.linkUrlForNode(link)).toBe('mailto:test@example.com');
  expect(Utils.openableLinkUrlForNode(link)).toBeNull();
});

test('treats any viewport intersection as visible, including oversized elements', () => {
  const oversizedParagraph = document.createElement('p');
  document.body.append(oversizedParagraph);
  vi.spyOn(oversizedParagraph, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(-100, -100, window.innerWidth + 200, window.innerHeight + 200),
  );

  expect(Utils.nodeIsInViewport(oversizedParagraph)).toBe(true);
});

test('does not treat an element outside the viewport as visible', () => {
  const paragraph = document.createElement('p');
  document.body.append(paragraph);
  vi.spyOn(paragraph, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, window.innerHeight + 1, 100, 20),
  );

  expect(Utils.nodeIsInViewport(paragraph)).toBe(false);
});

test('dispatches pointer and mouse activation events in browser order', () => {
  const button = document.createElement('button');
  document.body.append(button);
  const receivedEvents: string[] = [];
  [
    'pointerover',
    'mouseover',
    'pointerdown',
    'mousedown',
    'pointerup',
    'mouseup',
    'click',
    'pointerout',
    'mouseout',
  ].forEach(eventName => {
    button.addEventListener(eventName, () => receivedEvents.push(eventName));
  });

  Utils.clickOrFocusNode(button);

  expect(receivedEvents).toEqual([
    'pointerover',
    'mouseover',
    'pointerdown',
    'mousedown',
    'pointerup',
    'mouseup',
    'click',
    'pointerout',
    'mouseout',
  ]);
});

test('releases a frame selection once the cursor leaves that frame, not when it stays', async () => {
  const commands: string[] = [];
  const frameNode = (name: string, boundary = document.createElement('iframe')) => {
    document.body.append(boundary);
    const node = document.createElement('p');
    setFrameTarget(node, {
      boundary,
      alive: () => true,
      command: (command: FrameCommand) => {
        commands.push(`${name}:${String(command)}`);
        return Promise.resolve(true);
      },
      paint: vi.fn(),
      row: {
        id: 1,
        kind: 'text',
        action: null,
        label: name,
        text: name,
        context: '',
        href: null,
        disabled: false,
        focusable: false,
        score: 1,
        term: null,
        distance: null,
      },
    });
    return node;
  };
  const shared = document.createElement('iframe');
  const first = frameNode('first', shared);
  const sibling = frameNode('first-again', shared);
  const other = frameNode('other');
  const local = document.createElement('p');
  local.textContent = 'Local text';
  document.body.append(local);

  Utils.selectNodeContents(first);
  // An effect clears before selecting again in the same frame: no release goes out.
  Utils.clearPageSelection();
  Utils.selectNodeContents(sibling);
  await Promise.resolve();
  expect(commands).toEqual(['first:select', 'first-again:select']);

  Utils.selectNodeContents(other);
  await Promise.resolve();
  expect(commands.slice(2)).toEqual(['other:select', 'first-again:deselect']);

  Utils.selectNodeContents(local);
  await Promise.resolve();
  expect(commands.slice(4)).toEqual(['other:deselect']);
  Utils.clearPageSelection();
  document.body.replaceChildren();
});
