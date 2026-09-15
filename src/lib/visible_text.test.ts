import { iterateRenderedText, visibleText } from './visible_text.js';
import { normalizeSearchText } from './search_text.js';

test('normalizes canonically equivalent Unicode spellings without dropping accents', () => {
  expect(normalizeSearchText('CAFE\u0301')).toBe(normalizeSearchText('café'));
  expect(normalizeSearchText('café')).not.toBe(normalizeSearchText('cafe'));
});

test.each([
  ['<p>  Account \n   <strong> settings</strong>  </p>', 'Account settings'],
  ['<p>Account<br>settings</p>', 'Account\nsettings'],
  ['<div>Account<div>settings</div>help</div>', 'Account\nsettings\nhelp'],
  ['<p>Acc<span>ount</span><span hidden>secret</span> settings</p>', 'Account settings'],
  ['<pre>  Account\n    <span>settings</span>  </pre>', '  Account\n    settings  '],
  ['<p style="white-space:pre-wrap">  Account\n    settings  </p>', '  Account\n    settings  '],
  ['<p style="white-space:pre-line"> Account   \n  settings </p>', 'Account\nsettings'],
  ['<p>Account <span> \t </span> settings</p>', 'Account settings'],
  ['<p>Account <br>  <br> settings</p>', 'Account\n\nsettings'],
  ['<p style="white-space:break-spaces"> Account   settings </p>', ' Account   settings '],
  [
    '<pre>  <span style="white-space:normal">Account   settings</span>  </pre>',
    '  Account settings  ',
  ],
])('reads rendered whitespace in %s', (html, expected) => {
  document.body.innerHTML = html;
  expect(visibleText(document.body.firstElementChild!)).toBe(expected);
});

test('bounds text segments and collapses whitespace across processing chunks', () => {
  const paragraph = document.createElement('p');
  paragraph.textContent = 'x'.repeat(1023) + ' '.repeat(2050) + 'settings';
  document.body.append(paragraph);
  expect(visibleText(paragraph)).toBe('x'.repeat(1023) + ' settings');
  const parts = [...iterateRenderedText(paragraph)];
  expect(parts.filter(part => part === null).length).toBeGreaterThan(3);
  expect(parts.every(part => !part || part.text.length <= 1024)).toBe(true);
});

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
