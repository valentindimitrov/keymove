import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';

const root = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${root}?.querySelector('[aria-label="Search page"]')`;
const imageStatus = `${root}?.querySelector('.keymove-image-status')?.textContent`;
export async function checkRelatedImages(client: ChromiumClient, origin: string) {
  const page = await openPage(client, `${origin}images.html`);
  try {
    await page.activate();
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true' && document.getElementById('shoe').complete`,
    );
    await page.key('i', 1);
    await waitFor(page, `${imageStatus} === 'Image 1 / 1' && ${input}.value === ''`);
    await page.key(' ');
    await waitFor(page, `${root}.querySelectorAll('[role="menuitem"]').length === 4`);
    await page.key('Escape');
    await waitFor(page, `${imageStatus} !== 'Image 1 / 1'`);
    await page.key('f', 1);
    for (const key of 'Samba shoe') await page.key(key);
    await waitFor(page, `${root}?.querySelector('.keymove-selected-selection')`);
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false' && ${root}.querySelector('#keymove-actions-hint')`,
    );
    await page.key('i', 1);
    await waitFor(page, `${imageStatus} === 'Image 1 / 1'`);
    await page.key('ArrowRight');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Orange walking shoe"]')`,
    );
    await page.key(' ');
    await waitFor(page, `${root}.querySelector('[role="menu"]')`);
    assert.equal(await page.evaluate(`${root}.querySelectorAll('[role="menuitem"]').length`), 4);
    writeFileSync(path.resolve('.artifacts/image-actions.png'), await page.screenshot());
    await page.key('Enter');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Image viewer"] img')?.src === document.getElementById('other').src`,
    );
    await page.key('Escape');
    await page.key('ArrowLeft');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Purple training shoe"]')`,
    );
    await page.key('ArrowDown');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Camera photograph"]')`,
    );
    await page.key('ArrowUp');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Purple training shoe"]')`,
    );
    writeFileSync(path.resolve('.artifacts/image-card-selection.png'), await page.screenshot());
    await page.key(' ');
    await page.key('Enter');
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
    await page.setViewport(420, 650);
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Image viewer"] img').getBoundingClientRect().right <= innerWidth`,
    );
    writeFileSync(path.resolve('.artifacts/image-viewer-narrow.png'), await page.screenshot());
    await page.key('Escape');
    await waitFor(
      page,
      `!${root}.querySelector('[aria-label="Image viewer"]') && ${root}.activeElement === ${input}`,
    );
    await page.key(' ');
    await page.key('3', 1);
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
    await page.key('v', process.platform === 'darwin' ? 4 : 2);
    await waitFor(page, `document.querySelector('#paste-image img')`);
    // Exercise the deferred ClipboardItem path with a real paste as well.
    await page.evaluate(`${input}.focus()`);
    await page.key(' ');
    await waitFor(page, `${root}.querySelector('[role="menu"]')`);
    await page.key('4', 1);
    await waitFor(page, `!${root}.querySelector('[role="menu"]')`);
    await page.evaluate(
      `(() => { const field=document.createElement('textarea'); field.id='paste-image-address'; document.body.append(field); field.focus(); })()`,
    );
    await page.key('v', process.platform === 'darwin' ? 4 : 2);
    await waitFor(
      page,
      `document.getElementById('paste-image-address').value === document.getElementById('shoe').src`,
    );
    await page.key('f', 1);
    await page.key('a', process.platform === 'darwin' ? 4 : 2);
    await page.key('Backspace');
    await waitFor(page, `${input}.value === ''`);
    for (const key of 'Embedded trainer') await page.key(key);
    await waitFor(page, `${root}.querySelector('[role="status"]')?.textContent?.includes('1 / 1')`);
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false' && ${root}.querySelector('#keymove-actions-hint')`,
    );
    await page.key('i', 1);
    await waitFor(page, `${imageStatus} === 'Image 1 / 1'`);
    await page.key('ArrowRight');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Selected image: Orange walking shoe"]')`,
    );
    await page.key(' ');
    await page.key('Enter');
    await waitFor(
      page,
      `${root}.querySelector('[aria-label="Image viewer"] img')?.naturalWidth === 780`,
    );
    assert.equal(
      await page.evaluate(`${root}.querySelector('[aria-label="Image viewer"] img').alt`),
      'Orange walking shoe',
    );
    await page.key('Escape');
    await page.key(' ');
    await waitFor(page, `${root}.querySelector('[role="menu"]')`);
    await page.key('Escape');
    await waitFor(page, `${imageStatus} !== 'Image 1 / 1'`);
    assert.equal(await page.evaluate(`${input}.value`), 'Embedded trainer');
    await page.key('Backspace', process.platform === 'darwin' ? 4 : 2);
    for (const key of 'Shadow camera') await page.key(key);
    await waitFor(page, `${root}.querySelector('.keymove-selected-selection')`);
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false' && ${root}.querySelector('#keymove-actions-hint')`,
    );
    await page.key('i', 1);
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
