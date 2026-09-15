import assert from 'node:assert/strict';
import { waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';

const shadow = `document.getElementById('keymove-root').shadowRoot`;
const input = `${shadow}.querySelector('[aria-label="Search page"]')`;
const summary = `${shadow}.querySelector('[role="status"]').textContent`;
const autohide = `Array.from(document.querySelectorAll('label')).find(label => label.textContent === 'Autohide').control`;

async function query(page: TestPage, value: string) {
  await page.key('f', 1);
  for (const character of value) await page.key(character);
  await waitFor(page, `${summary} === 'Text 1 / 1'`);
  await waitFor(page, `${shadow}.querySelector('[role="option"][aria-disabled="false"]')`);
}

export async function checkReturnPosition(page: TestPage, popup: TestPage) {
  await popup.evaluate(`if (${autohide}.checked) ${autohide}.click()`);
  try {
    await page.activate();
    await waitFor(page, `document.hasFocus() && ${shadow}.activeElement === ${input}`);
    await page.key('Escape');
    await page.evaluate(`(() => {
      const fixture = document.createElement('div');
      fixture.id = 'return-fixture';
      fixture.innerHTML = '<div style="height:2000px"></div><h2 id="return-match">Help improve MDN</h2><div id="return-scroller" style="height:180px;overflow:auto"><div style="height:1000px"></div><p id="nested-return-match">Nestedreturntarget</p><div style="height:500px"></div></div><button id="return-next">Next control</button><div style="height:1000px"></div>';
      document.body.append(fixture);
      globalThis.__returnEscape = 0;
      document.getElementById('return-next').addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.defaultPrevented) globalThis.__returnEscape++;
      });
      scrollTo({top:170, behavior:'instant'});
    })()`);
    for (const shortcut of ['Tab', 'Alt+1']) {
      assert.equal(await page.evaluate('document.activeElement === document.body'), true);
      const original = await page.evaluate('scrollY');
      // Start by typing while reading, with no page control focused (the MDN case).
      for (const character of 'improve') await page.key(character);
      await waitFor(page, `${summary} === 'Text 1 / 1'`);
      await waitFor(page, `${shadow}.querySelector('[role="option"][aria-disabled="false"]')`);
      await page.key(shortcut === 'Tab' ? 'Tab' : '1', shortcut === 'Tab' ? 0 : 1);
      await waitFor(
        page,
        `document.getElementById('return-match').getBoundingClientRect().top < innerHeight`,
      );
      assert(((await page.evaluate('scrollY')) as number) > (original as number));
      await page.key('Backspace', 1);
      await waitFor(page, `${input}.getClientRects().length === 0`);
      assert.equal(
        await page.evaluate('scrollY'),
        original,
        `${shortcut}: return to original position`,
      );
      assert.equal(await page.evaluate(`${input}.value`), '');
    }

    await query(page, 'improve');
    await page.key('Tab');
    const jumped = await page.evaluate('scrollY');
    await page.key('Escape');
    await waitFor(page, `${input}.getClientRects().length === 0`);
    assert.equal(
      await page.evaluate('scrollY'),
      jumped,
      'Escape closes in one press and stays here',
    );

    await page.evaluate(
      `document.getElementById('return-scroller').scrollTop = 80; scrollTo({top:0, behavior:'instant'})`,
    );
    await query(page, 'nestedreturntarget');
    await page.key('Tab');
    assert(
      ((await page.evaluate(`document.getElementById('return-scroller').scrollTop`)) as number) >
        80,
    );
    await page.key('Backspace', 1);
    assert.equal(await page.evaluate(`document.getElementById('return-scroller').scrollTop`), 80);
    assert.equal(
      await page.evaluate('scrollY'),
      0,
      'Nested result restores both container and page',
    );

    await query(page, 'improve');
    await page.key('Tab');
    await page.evaluate(`document.getElementById('return-next').focus()`);
    const moved = await page.evaluate('scrollY');
    await page.key('Escape');
    assert.equal(await page.evaluate('globalThis.__returnEscape'), 1);
    assert.equal(await page.evaluate('document.activeElement.id'), 'return-next');
    assert.equal(await page.evaluate('scrollY'), moved);
    // Reopening from this control starts a new session, not the original reading position.
    await query(page, 'improve');
    await page.key('Tab');
    await page.key('Backspace', 1);
    assert.equal(await page.evaluate('scrollY'), moved);
  } finally {
    await page.evaluate(`document.getElementById('return-fixture')?.remove()`);
    await popup.evaluate(`if (!${autohide}.checked) ${autohide}.click()`);
  }
}
