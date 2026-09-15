import assert from 'node:assert/strict';
import { waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';

const shadow = `document.getElementById('keymove-root').shadowRoot`;
const input = `${shadow}.querySelector('[aria-label="Search page"]')`;
const autohide = `Array.from(document.querySelectorAll('label')).find(label => label.textContent === 'Autohide').control`;

export async function checkFocusRestoration(page: TestPage, popup: TestPage) {
  // Keep the bar visible after page focus changes to exercise the Escape ownership guard.
  await popup.evaluate(`if (${autohide}.checked) ${autohide}.click()`);
  try {
    await page.activate();
    await waitFor(page, `document.hasFocus() && ${shadow}.activeElement === ${input}`);
    await page.key('Escape');
    await waitFor(page, `${input}.value === ''`);
    await page.evaluate(`(() => {
      const fixture = document.createElement('div');
      fixture.id = 'focus-fixture';
      fixture.innerHTML = '<textarea id="focus-origin" aria-label="Original field">Original text</textarea><button id="focus-next">Next control</button><div id="focus-shadow-host"></div>';
      document.body.append(fixture);
      const original = document.getElementById('focus-origin');
      original.style.cssText = 'position:absolute;top:0;left:0';
      original.focus();
      original.setSelectionRange(2, 6, 'backward');
      const root = document.getElementById('focus-shadow-host').attachShadow({mode:'open'});
      root.innerHTML = '<input aria-label="Shadow field" value="Shadow text">';
      globalThis.__focusEscape = 0;
      document.getElementById('focus-next').addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.defaultPrevented) globalThis.__focusEscape++;
      });
    })()`);
    await page.key('f', 1);
    await waitFor(page, `${shadow}.activeElement === ${input}`);
    await page.key('f', 1);
    await page.key('z');
    await waitFor(page, `${input}.value === 'z'`);
    await page.key('Escape');
    assert.equal(await page.evaluate(`${shadow}.activeElement === ${input}`), true);
    await page.evaluate('scrollTo(0, 1000)');
    const scroll = await page.evaluate('scrollY');
    assert.equal(typeof scroll, 'number');
    assert((scroll as number) > 0, 'The return-focus check needs an off-screen origin');
    await page.key('Escape');
    await waitFor(page, `document.activeElement === document.getElementById('focus-origin')`);
    assert.deepEqual(
      await page.evaluate(`(() => {
      const field = document.getElementById('focus-origin');
      return [field.selectionStart, field.selectionEnd, field.selectionDirection];
    })()`),
      [2, 6, 'backward'],
    );
    assert.equal(await page.evaluate('scrollY'), scroll, 'Focus restoration must not scroll back');

    await page.key('f', 1);
    await page.evaluate(`document.getElementById('focus-next').focus()`);
    await page.key('Escape');
    assert.equal(
      await page.evaluate('globalThis.__focusEscape'),
      1,
      'Page button must receive Escape',
    );
    assert.equal(await page.evaluate(`document.activeElement.id`), 'focus-next');
    assert.equal(await page.evaluate(`${input}.getClientRects().length > 0`), true);
    await page.key('f', 1);
    await page.key('Escape');
    assert.equal(
      await page.evaluate(`document.activeElement.id`),
      'focus-next',
      'Reopening must capture the new origin',
    );

    await page.evaluate(
      `document.getElementById('focus-shadow-host').shadowRoot.querySelector('input').focus()`,
    );
    await page.key('f', 1);
    await page.key('Escape');
    assert.equal(
      await page.evaluate(
        `document.getElementById('focus-shadow-host').shadowRoot.activeElement?.getAttribute('aria-label')`,
      ),
      'Shadow field',
    );

    await page.key('f', 1);
    await page.evaluate(`${input}.blur()`);
    await page.key('Escape');
    assert.equal(await page.evaluate(`${input}.getClientRects().length > 0`), true);
    await page.key('f', 1);
    await page.key('Escape');
    assert.equal(
      await page.evaluate(`document.getElementById('focus-shadow-host').shadowRoot.activeElement`),
      null,
      'Explicit blur discards the old return target',
    );

    await page.evaluate(`document.getElementById('focus-origin').focus()`);
    await page.key('f', 1);
    await page.evaluate(`document.getElementById('focus-origin').remove()`);
    await page.key('Escape');
    assert.equal(await page.evaluate(`${shadow}.activeElement === ${input}`), false);
  } finally {
    await page.evaluate(`document.getElementById('focus-fixture')?.remove()`);
    await popup.evaluate(`if (!${autohide}.checked) ${autohide}.click()`);
  }
}
