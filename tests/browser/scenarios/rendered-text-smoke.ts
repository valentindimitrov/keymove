import { expect } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { attachFailure, openPage } from '../pages.js';
import { keymove, replaceQuery, typeText } from '../keymove.js';

type Scenario = {
  /** Markup for the sample paragraph; it always has the id "sample". */
  html: string;
  query: string;
  /** What the browser renders and copies, stated explicitly as an independent oracle. */
  copied: string;
  /** The text the page-wide highlight range covers. */
  range: string;
  fuzzy?: boolean;
};

const scenarios: Scenario[] = [
  { html: '<p id="sample">İstanbul</p>', query: 'stanbul', copied: 'İstanbul', range: 'stanbul' },
  {
    html: '<p id="sample">Cafe<span>́</span></p>',
    query: 'café',
    copied: 'Café',
    range: 'Café',
  },
  {
    html: '<p id="sample">Настройки</p>',
    query: 'НАСТРОЙКИ',
    copied: 'Настройки',
    range: 'Настройки',
  },
  { html: '<p id="sample">ΕΛΛΑΣ</p>', query: 'ελλας', copied: 'ΕΛΛΑΣ', range: 'ΕΛΛΑΣ' },
  { html: '<p id="sample">日本語検索</p>', query: '日本語', copied: '日本語検索', range: '日本語' },
  {
    html: '<p id="sample">مرحبا بالعالم</p>',
    query: 'مرحبا',
    copied: 'مرحبا بالعالم',
    range: 'مرحبا',
  },
  { html: '<p id="sample">𐐀𐐁𐐂</p>', query: '𐐨𐐩𐐪', copied: '𐐀𐐁𐐂', range: '𐐀𐐁𐐂' },
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

export async function checkRenderedText(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}fixtures.html?rendered-text`);
  const { bar, status } = keymove(page);
  try {
    // The renderer can expose the page before the DOM and stored settings are ready.
    await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', /.*/);
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
    for (const scenario of scenarios) {
      await replaceQuery(page, '');
      await page.evaluate(html => {
        document.getElementById('fixture')!.innerHTML =
          html + '<textarea aria-label="Paste target"></textarea>';
      }, scenario.html);
      // The browser's rendered text must agree with the stated oracle, not our own reader.
      expect(await page.locator('#sample').innerText()).toBe(scenario.copied);
      await typeText(page, scenario.query);
      await expect(status).toHaveText(`Text ${scenario.fuzzy ? '~ ' : ''}1 / 1`);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const marks = CSS.highlights.get('keymove-search-results');
            return marks?.size === 1 ? [...marks][0]!.toString() : null;
          }),
        )
        .toBe(scenario.range);
      await page.keyboard.press('Tab');
      await expect
        .poll(() => page.evaluate(() => getSelection()?.toString()))
        .toBe(scenario.copied);
      await page.keyboard.press('ControlOrMeta+c');
      const paste = page.getByRole('textbox', { name: 'Paste target', exact: true });
      await paste.focus();
      await page.keyboard.press('ControlOrMeta+v');
      await expect(paste).toHaveValue(scenario.copied);
    }
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}
