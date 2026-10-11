import assert from 'node:assert/strict';
import type { BrowserContext } from '@playwright/test';
import { openPage, waitFor } from '../pages.js';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

export async function checkRenderedText(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}fixtures.html?rendered-text`);
  try {
    await page.bringToFront();
    // The renderer can expose the target before the DOM and stored settings are ready.
    await waitFor(
      page,
      `document.documentElement?.dataset.fixtureReady && ${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`,
    );
    await waitFor(page, 'document.hasFocus()');
    const scenarios: {
      html: string;
      query: string;
      copied: string;
      range: string;
      fuzzy?: boolean;
    }[] = [
      ...[
        ['İstanbul', 'stanbul', 'stanbul'],
        ['Cafe<span>\u0301</span>', 'café', 'Cafe\u0301'],
        ['Настройки', 'НАСТРОЙКИ', 'Настройки'],
        ['ΕΛΛΑΣ', 'ελλας', 'ΕΛΛΑΣ'],
        ['日本語検索', '日本語', '日本語'],
        ['مرحبا بالعالم', 'مرحبا', 'مرحبا'],
        ['𐐀𐐁𐐂', '𐐨𐐩𐐪', '𐐀𐐁𐐂'],
      ].map(([text, query, range]) => ({
        html: `<p id="sample">${text}</p>`,
        query: query!,
        range: range!,
        copied: text!.replace(/<[^>]+>/g, ''),
        fuzzy: false,
      })),
      {
        html: '<p id="sample">Account     settings</p>',
        query: 'account settings',
        copied: 'Account settings',
        range: 'Account     settings',
      },
      {
        html: '<p id="sample">Account \n<span>  settings</span></p>',
        query: 'account settings',
        copied: 'Account settings',
        range: 'Account \n  settings',
      },
      {
        html: '<p id="sample">Account<br>settings</p>',
        query: 'account settings',
        copied: 'Account\nsettings',
        range: 'Accountsettings',
      },
      {
        html: '<p id="sample">Account<span style="display:block">settings</span></p>',
        query: 'account settings',
        copied: 'Account\nsettings',
        range: 'Accountsettings',
      },
      {
        html: '<p id="sample">Account     settings</p>',
        query: 'account settongs',
        copied: 'Account settings',
        range: 'Account     settings',
        fuzzy: true,
      },
      {
        html: '<pre id="sample">  Account\n    <span>settings</span>  </pre>',
        query: 'settings',
        copied: '  Account\n    settings  ',
        range: 'settings',
      },
      {
        html: '<p id="sample" style="white-space:pre-wrap">  Account\n    settings  </p>',
        query: 'settings',
        copied: '  Account\n    settings  ',
        range: 'settings',
      },
    ];
    for (const scenario of scenarios) {
      await page.keyboard.press('Alt+f');
      await waitFor(page, `${shadow}.activeElement === ${input}`);
      await page.keyboard.press(`${modifier}+a`);
      await page.keyboard.press('Backspace');
      await waitFor(page, `${input}.value === ''`);
      await page.evaluate(
        `document.getElementById('fixture').innerHTML = ${JSON.stringify(
          scenario.html + '<textarea aria-label="Paste target"></textarea>',
        )}`,
      );
      // Use the browser's rendered text as an independent oracle, not our own reader.
      assert.equal(
        await page.evaluate(`document.getElementById('sample').innerText`),
        scenario.copied,
      );
      for (const character of scenario.query) {
        // Playwright inserts characters outside its keyboard layout without a
        // keydown. Restore the query caret before that composition-style input.
        if (!/^[\x20-\x7e]$/.test(character)) await page.keyboard.press('End');
        await page.keyboard.type(character);
      }
      assert.equal(await page.evaluate(`${input}.value`), scenario.query);
      const summary = `Text ${scenario.fuzzy ? '~ ' : ''}1 / 1`;
      await waitFor(
        page,
        `${shadow}.querySelector('[role="status"]').textContent === ${JSON.stringify(summary)}`,
      );
      await waitFor(
        page,
        `CSS.highlights.get('keymove-search-results')?.size === 1 &&
        [...CSS.highlights.get('keymove-search-results')][0].toString() === ${JSON.stringify(scenario.range)}`,
      );
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(`getSelection().toString()`), scenario.copied);
      await page.keyboard.press(`${modifier}+c`);
      await page.evaluate(`document.querySelector('textarea').focus()`);
      await page.keyboard.press(`${modifier}+v`);
      await waitFor(
        page,
        `document.querySelector('textarea').value === ${JSON.stringify(scenario.copied)}`,
      );
    }
  } finally {
    await page.close();
  }
}
