import Utils from './utils.js';

afterEach(() => {
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
