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
  const yipYipInput = document.createElement('input');
  const pageInput = document.createElement('textarea');
  document.body.append(yipYipInput, pageInput);

  pageInput.focus();

  expect(Utils.differentInputIsActive(yipYipInput)).toBe(true);
});
