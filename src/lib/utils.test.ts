import Utils from './utils.js';

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
