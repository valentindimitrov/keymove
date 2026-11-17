import { expect } from '@playwright/test';
import type { BrowserContext, ElementHandle, Page } from '@playwright/test';
import { attachFailure, openPage, selectionText, snapshot } from '../pages.js';
import { keymove, searchFor } from '../keymove.js';

/** Where the extension host is mounted: the page body or the component's native dialog. */
function hostPlace(page: Page, host: ElementHandle) {
  return page.evaluate(element => {
    const parent = element.parentElement;
    if (parent === document.body) return 'body';
    const dialog = document.getElementById('component')?.shadowRoot?.querySelector('dialog');
    return parent === dialog ? 'component dialog' : (parent?.tagName ?? null);
  }, host);
}

export async function checkShadowSearch(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}shadow.html`);
  const { bar, status } = keymove(page);
  // The open root is reachable from the page; locators pierce it for page-side checks.
  const component = page.locator('#component');
  const search = (query: string, mode: 'Text' | 'Actions', count = 1) =>
    searchFor(page, query, mode, count);
  try {
    await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', /.*/);
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    // Follow the one extension host as it moves into the component's dialog and back.
    const host = (await page.locator('#keymove-root').elementHandle())!;
    // Opening a native shadow dialog before the first query must not strand the UI
    // outside its inert boundary while no search index exists yet.
    await component.evaluate(element => element.shadowRoot!.querySelector('dialog')!.showModal());
    await expect.poll(() => hostPlace(page, host)).toBe('component dialog');
    await search('close component dialog', 'Actions');
    await page.keyboard.press('Enter');
    await expect.poll(() => hostPlace(page, host)).toBe('body');
    await search('orbit', 'Text', 4);
    for (const expected of [
      'Orbit before',
      'Orbit middle paragraph.',
      'Orbit nested paragraph.',
      'Orbit after',
    ]) {
      await expect.poll(() => selectionText(page)).toBe(expected);
      await page.keyboard.press('Tab');
    }
    await expect
      .poll(() => page.evaluate(() => CSS.highlights.get('keymove-search-results')?.size))
      .toBe(4);
    // Only KeyMove's highlight styles are adopted into the matched root.
    expect(
      await component.evaluate(element =>
        element.shadowRoot!.adoptedStyleSheets.some(sheet =>
          [...sheet.cssRules].some(rule => rule.cssText.includes('keymove-search-results')),
        ),
      ),
    ).toBe(true);
    await snapshot(page, 'shadow-highlights');
    await search('bright comet ahead', 'Text');
    // Chromium's Selection.toString() can omit assigned slot text. Verify composed
    // endpoints and the actual clipboard separately instead of treating it as an oracle.
    await expect
      .poll(() =>
        component.evaluate(element => {
          const root = element.shadowRoot!;
          const range = getSelection()?.getComposedRanges({ shadowRoots: [root] })[0];
          const block = root.getElementById('slotted')!;
          const last = block.lastChild as Text;
          return (
            range?.startContainer === block.firstChild &&
            range.startOffset === 0 &&
            range.endContainer === last &&
            range.endOffset === last.length
          );
        }),
      )
      .toBe(true);
    expect(
      await page.evaluate(() =>
        [...(CSS.highlights.get('keymove-search-results') ?? [])].map(range => range.toString()),
      ),
    ).toEqual(['Bright ', 'comet', ' ahead']);
    await snapshot(page, 'shadow-search');
    await page.keyboard.press('ControlOrMeta+c');
    const paste = page.getByRole('textbox', { name: 'Paste target', exact: true });
    await paste.focus();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(paste).toHaveValue('Bright comet ahead');
    // Editors inside the root receive focus and keep their typing.
    await search('component mailbox', 'Actions');
    await page.keyboard.press('Enter');
    const mailbox = component.locator('#mailbox');
    await expect(mailbox).toBeFocused();
    for (const char of 'hello') await page.keyboard.type(char);
    await expect(mailbox).toHaveValue('hello');
    await search('component digest', 'Actions');
    await page.keyboard.press('Enter');
    await expect(component.locator('#digest')).toBeChecked();
    await search('nested ignition', 'Actions');
    await page.keyboard.press('Enter');
    await expect(component).toHaveAttribute('data-nested', 'yes');
    // Mutations inside nested roots refresh the active query.
    await search('orbit nested', 'Text');
    await component.evaluate(element => {
      element.shadowRoot!.getElementById('nested')!.shadowRoot!.querySelector('p')!.textContent =
        'Changed starlight';
    });
    await expect(status).toHaveText(/0 \/ 0$/);
    await search('changed starlight', 'Text');
    await search('open component dialog', 'Actions');
    await page.keyboard.press('Enter');
    await expect.poll(() => hostPlace(page, host)).toBe('component dialog');
    await search('save component', 'Actions');
    await page.keyboard.press('Enter');
    await expect(component).toHaveAttribute('data-saved', 'yes');
    await search('close component dialog', 'Actions');
    await page.keyboard.press('Enter');
    await expect.poll(() => hostPlace(page, host)).toBe('body');
    await search('satellite controls', 'Text');
    await page.keyboard.press('Enter');
    await expect(component).toHaveAttribute('data-slotted-action', 'yes');
    await search('lunar picture', 'Actions');
    await page.keyboard.press('Enter');
    await expect(component).toHaveAttribute('data-image-action', 'yes');
    // Hiding the component releases its results and KeyMove's adopted styles,
    // preserving the page's own adopted sheet.
    await search('launch capsule', 'Actions');
    await component.evaluate(element => {
      (element as HTMLElement).style.display = 'none';
    });
    await expect(status).toHaveText(/0 \/ 0$/);
    await expect
      .poll(() => component.evaluate(element => element.shadowRoot!.adoptedStyleSheets.length))
      .toBe(1);
    expect(
      await component.evaluate(element =>
        element.shadowRoot!.adoptedStyleSheets[0]!.cssRules[0]!.cssText.includes(
          '--page-owned-sheet',
        ),
      ),
    ).toBe(true);
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}
