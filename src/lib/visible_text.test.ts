import { visibleText } from './visible_text.js';

afterEach(() => {
  document.body.innerHTML = '';
});

test('allows descendants to override visibility while pruning display-hidden subtrees', () => {
  document.body.innerHTML =
    '<p style="visibility: hidden">Hidden <span style="visibility: visible">Visible</span></p><div style="display: none"><span style="visibility: visible">Secret</span></div>';
  expect(visibleText(document.body)).toBe('Visible');
});

test('does not inspect text or styles inside an excluded subtree', () => {
  document.body.innerHTML = `<p>Visible</p><div hidden>${'<span>Secret</span>'.repeat(250)}</div>`;
  const style = vi.spyOn(window, 'getComputedStyle');
  expect(visibleText(document.body)).toBe('Visible');
  expect(style).not.toHaveBeenCalledWith(document.querySelector('span'));
  style.mockRestore();
});
