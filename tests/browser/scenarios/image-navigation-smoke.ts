import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { attachFailure, openPage, snapshot } from '../pages.js';
import { keymove, replaceQuery } from '../keymove.js';

/** Waits until the search for the typed query has settled with its action hint shown. */
async function settled(page: Page) {
  const { suggestions, host } = keymove(page);
  await expect(suggestions).toHaveAttribute('aria-busy', 'false');
  await expect(host.locator('#keymove-actions-hint')).toBeAttached();
}

export async function checkRelatedImages(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}images.html`);
  const { bar, input, status, menu, host } = keymove(page);
  const imageStatus = host.locator('.keymove-image-status');
  // The status is removed, or names another state, once the image selection ends.
  const imageSelected = imageStatus.filter({ hasText: /^Image 1 \/ 1$/ });
  const menuItems = host.getByRole('menuitem', { includeHidden: true });
  const viewerImage = host.locator('[aria-label="Image viewer"] img');
  const selectedImage = (name: string) => host.locator(`[aria-label="Selected image: ${name}"]`);
  const viewerSource = () =>
    viewerImage.evaluate(image => (image as HTMLImageElement).src).catch(() => null);
  const shoeSource = () => page.locator('#shoe').evaluate(image => (image as HTMLImageElement).src);
  try {
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await expect
      .poll(() => page.locator('#shoe').evaluate(image => (image as HTMLImageElement).complete))
      .toBe(true);
    // Alt+I with no result selected opens an on-screen image near the viewport centre.
    await page.keyboard.press('Alt+i');
    await expect(imageStatus).toHaveText('Image 1 / 1');
    await expect(input).toHaveValue('');
    await page.keyboard.press('Space');
    await expect(menuItems).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(imageSelected).toHaveCount(0);
    await page.keyboard.press('Alt+f');
    for (const key of 'Samba shoe') await page.keyboard.type(key);
    await expect(host.locator('.keymove-selected-selection')).toBeAttached();
    await settled(page);
    await page.keyboard.press('Alt+i');
    await expect(imageStatus).toHaveText('Image 1 / 1');
    await page.keyboard.press('ArrowRight');
    await expect(selectedImage('Orange walking shoe')).toBeAttached();
    await page.keyboard.press('Space');
    await expect(menu).toHaveCount(1);
    await expect(menuItems).toHaveCount(4);
    await snapshot(page, 'image-actions');
    await page.keyboard.press('Enter');
    const otherSource = await page
      .locator('#other')
      .evaluate(image => (image as HTMLImageElement).src);
    await expect.poll(viewerSource).toBe(otherSource);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowLeft');
    await expect(selectedImage('Purple training shoe')).toBeAttached();
    await page.keyboard.press('ArrowDown');
    await expect(selectedImage('Camera photograph')).toBeAttached();
    await page.keyboard.press('ArrowUp');
    await expect(selectedImage('Purple training shoe')).toBeAttached();
    await snapshot(page, 'image-card-selection');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect
      .poll(() =>
        viewerImage.evaluate(image => (image as HTMLImageElement).naturalWidth).catch(() => 0),
      )
      .toBe(780);
    expect(
      await viewerSource(),
      'A caption below a wishlist/image header must select its own product photo',
    ).toBe(await shoeSource());
    await snapshot(page, 'image-viewer');
    await page.setViewportSize({ width: 420, height: 650 });
    await expect
      .poll(() => viewerImage.evaluate(image => image.getBoundingClientRect().right <= innerWidth))
      .toBe(true);
    await snapshot(page, 'image-viewer-narrow');
    await page.keyboard.press('Escape');
    await expect(host.locator('[aria-label="Image viewer"]')).toHaveCount(0);
    await expect(input).toBeFocused();
    // Alt+3 copies the image pixels; a failure would stay visible beside the menu.
    await page.keyboard.press('Space');
    await page.keyboard.press('Alt+3');
    await expect(menu, 'Same-origin image copy should succeed').toHaveCount(0);
    // Paste into an ordinary page editor: verify actual image bytes, not only API success.
    await page.evaluate(() => {
      const field = document.createElement('div');
      field.id = 'paste-image';
      field.contentEditable = 'true';
      document.body.append(field);
    });
    await page.locator('#paste-image').focus();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.locator('#paste-image img')).toBeAttached();
    // Page-editor focus resets search; reopen and select the image for the address-copy check.
    await page.keyboard.press('Alt+f');
    for (const key of 'Samba shoe') await page.keyboard.type(key);
    await settled(page);
    await page.keyboard.press('Alt+i');
    await expect(selectedImage('Purple training shoe')).toBeAttached();
    // Exercise the deferred ClipboardItem path with a real paste as well.
    await page.keyboard.press('Space');
    await expect(menu).toHaveCount(1);
    await page.keyboard.press('Alt+4');
    await expect(menu).toHaveCount(0);
    await page.evaluate(() => {
      const field = document.createElement('textarea');
      field.id = 'paste-image-address';
      document.body.append(field);
    });
    await page.locator('#paste-image-address').focus();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.locator('#paste-image-address')).toHaveValue(await shoeSource());
    // An image inside an iframe is selected through its owning frame. The larger viewer
    // would load it in the embedding page, which could read its address, so it is
    // unavailable for frame images (SECURITY.md, "Isolation from the page").
    await replaceQuery(page, 'Embedded trainer');
    await expect(status).toContainText('1 / 1');
    await settled(page);
    await page.keyboard.press('Alt+i');
    await expect(imageStatus).toHaveText('Image 1 / 1');
    await page.keyboard.press('ArrowRight');
    await expect(selectedImage('Orange walking shoe')).toBeAttached();
    await page.keyboard.press('Space');
    await expect(menu.getByRole('menuitem', { name: /View larger/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await expect(viewerImage).toHaveCount(0);
    // Escape from the image menu returns from the image to the result.
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(imageSelected).toHaveCount(0);
    await expect(input).toHaveValue('Embedded trainer');
    // Images inside open shadow roots release their selection when removed.
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    for (const key of 'Shadow camera') await page.keyboard.type(key);
    await expect(host.locator('.keymove-selected-selection')).toBeAttached();
    await settled(page);
    await page.keyboard.press('Alt+i');
    await expect(imageStatus).toHaveText('Image 1 / 1');
    await page.locator('#component').evaluate(component => component.remove());
    await expect(imageSelected).toHaveCount(0);
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}
