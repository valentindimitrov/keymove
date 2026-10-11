import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { openPage, waitFor } from '../pages.js';
import { expect } from '@playwright/test';
import { keymove } from '../keymove.js';

const root = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${root}?.querySelector('[aria-label="Search page"]')`;
const imageStatus = `${root}?.querySelector('.keymove-image-status')?.textContent`;
export async function checkRelatedImages(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}images.html`);
  try {
    await page.bringToFront();
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true' && document.getElementById('shoe').complete`,
    );
    await page.keyboard.press('Alt+i');
    await waitFor(page, `${imageStatus} === 'Image 1 / 1' && ${input}.value === ''`);
    await page.keyboard.press('Space');
    await waitFor(page, `${root}.querySelectorAll('[role="menuitem"]').length === 4`);
    await page.keyboard.press('Escape');
    await waitFor(page, `${imageStatus} !== 'Image 1 / 1'`);
    await page.keyboard.press('Alt+f');
    for (const key of 'Samba shoe') await page.keyboard.type(key);
    await waitFor(page, `${root}?.querySelector('.keymove-selected-selection')`);
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false' && ${root}.querySelector('#keymove-actions-hint')`,
    );
    await page.keyboard.press('Alt+i');
    await waitFor(page, `${imageStatus} === 'Image 1 / 1'`);
    await page.keyboard.press('ArrowRight');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Orange walking shoe"]')`,
    );
    await page.keyboard.press('Space');
    await expect(keymove(page).menu).toBeAttached();
    assert.equal(await page.evaluate(`${root}.querySelectorAll('[role="menuitem"]').length`), 4);
    writeFileSync(path.resolve('.artifacts/image-actions.png'), await page.screenshot());
    await page.keyboard.press('Enter');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Image viewer"] img')?.src === document.getElementById('other').src`,
    );
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowLeft');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Purple training shoe"]')`,
    );
    await page.keyboard.press('ArrowDown');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Camera photograph"]')`,
    );
    await page.keyboard.press('ArrowUp');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Purple training shoe"]')`,
    );
    writeFileSync(path.resolve('.artifacts/image-card-selection.png'), await page.screenshot());
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await waitFor(
      page,
      `${root}?.querySelector('[aria-label="Image viewer"] img')?.naturalWidth === 780`,
    );
    assert.equal(
      await page.evaluate(
        `${root}.querySelector('[aria-label="Image viewer"] img').src === document.getElementById('shoe').src`,
      ),
      true,
      'A caption below a wishlist/image header must select its own product photo',
    );
    writeFileSync(path.resolve('.artifacts/image-viewer.png'), await page.screenshot());
    await page.setViewportSize({ width: 420, height: 650 });
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Image viewer"] img').getBoundingClientRect().right <= innerWidth`,
    );
    writeFileSync(path.resolve('.artifacts/image-viewer-narrow.png'), await page.screenshot());
    await page.keyboard.press('Escape');
    await waitFor(
      page,
      `!${root}.querySelector('[aria-label="Image viewer"]') && ${root}.activeElement === ${input}`,
    );
    await page.keyboard.press('Space');
    await page.keyboard.press('Alt+3');
    await waitFor(
      page,
      `!${root}.querySelector('[role="menu"]') || ${root}.querySelector('[role="menu"]')?.parentElement.textContent.includes('Could not copy image')`,
    );
    assert.equal(
      await page.evaluate(`!!${root}.querySelector('[role="menu"]')`),
      false,
      'Same-origin image copy should succeed',
    );
    // Paste into an ordinary page editor: verify actual image bytes, not only API success.
    await page.evaluate(
      `(() => { const field=document.createElement('div'); field.id='paste-image'; field.contentEditable='true'; document.body.append(field); field.focus(); })()`,
    );
    await page.keyboard.press('ControlOrMeta+v');
    await waitFor(page, `document.querySelector('#paste-image img')`);
    // Page-editor focus resets search; reopen and select the image for the address-copy check.
    await page.keyboard.press('Alt+f');
    for (const key of 'Samba shoe') await page.keyboard.type(key);
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false' && ${root}.querySelector('#keymove-actions-hint')`,
    );
    await page.keyboard.press('Alt+i');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Purple training shoe"]')`,
    );
    // Exercise the deferred ClipboardItem path with a real paste as well.
    await page.keyboard.press('Space');
    await expect(keymove(page).menu).toBeAttached();
    await page.keyboard.press('Alt+4');
    await expect(keymove(page).menu).not.toBeAttached();
    await page.evaluate(
      `(() => { const field=document.createElement('textarea'); field.id='paste-image-address'; document.body.append(field); field.focus(); })()`,
    );
    await page.keyboard.press('ControlOrMeta+v');
    await waitFor(
      page,
      `document.getElementById('paste-image-address').value === document.getElementById('shoe').src`,
    );
    await page.keyboard.press('Alt+f');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await expect(keymove(page).input).toHaveValue('');
    for (const key of 'Embedded trainer') await page.keyboard.type(key);
    await waitFor(page, `${root}.querySelector('[role="status"]')?.textContent?.includes('1 / 1')`);
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false' && ${root}.querySelector('#keymove-actions-hint')`,
    );
    await page.keyboard.press('Alt+i');
    await waitFor(page, `${imageStatus} === 'Image 1 / 1'`);
    await page.keyboard.press('ArrowRight');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Orange walking shoe"]')`,
    );
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Image viewer"] img')?.naturalWidth === 780`,
    );
    assert.equal(
      await page.evaluate(`${root}.querySelector('[aria-label="Image viewer"] img').alt`),
      'Orange walking shoe',
    );
    await page.keyboard.press('Escape');
    await page.keyboard.press('Space');
    await expect(keymove(page).menu).toBeAttached();
    await page.keyboard.press('Escape');
    await waitFor(page, `${imageStatus} !== 'Image 1 / 1'`);
    assert.equal(await keymove(page).input.inputValue(), 'Embedded trainer');
    await page.keyboard.press('ControlOrMeta+Backspace');
    for (const key of 'Shadow camera') await page.keyboard.type(key);
    await waitFor(page, `${root}.querySelector('.keymove-selected-selection')`);
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false' && ${root}.querySelector('#keymove-actions-hint')`,
    );
    await page.keyboard.press('Alt+i');
    await waitFor(page, `${imageStatus} === 'Image 1 / 1'`);
    await page.evaluate(`document.getElementById('component').remove()`);
    await waitFor(page, `${imageStatus} !== 'Image 1 / 1'`);
    console.log(
      'Related image selection, spatial arrows, four-action menu, viewer, real image clipboard paste, iframe, shadow root and cleanup passed.',
    );
  } finally {
    await page.close();
  }
}
