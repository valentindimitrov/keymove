import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { attachFailure, openPage, snapshot } from '../pages.js';
import { keymove, searchFor } from '../keymove.js';

async function expectState(page: Page, state: string) {
  await expect(keymove(page).suggestions).toContainText(state);
}

const searchAction = (page: Page, query: string, count = 1) =>
  searchFor(page, query, 'Actions', count);

/** The element the extension host is mounted in: it moves into active modals and back. */
function hostParent(page: Page) {
  return page.evaluate(() => {
    const parent = document.getElementById('keymove-root')?.parentElement;
    return parent === document.body ? 'body' : (parent?.id ?? null);
  });
}

function activeId(page: Page) {
  return page.evaluate(() => document.activeElement?.id);
}

export async function checkControlNavigation(context: BrowserContext, origin: string) {
  await checkTransformedModal(context, origin, false);
  await checkTransformedModal(context, origin, true);
  const page = await openPage(context, `${origin}fixtures.html?controls`);
  const { bar, input, status, options, suggestions } = keymove(page);
  try {
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await page.evaluate(() => {
      const fixture = document.createElement('section');
      fixture.id = 'controls-fixture';
      fixture.innerHTML =
        '<label for="control-email">Contact mailbox</label><input id="control-email"><label>Weekly digest<input id="control-check" type="checkbox"></label><label>Express delivery<input id="control-radio" type="radio"></label><form id="control-form"><input type="submit" value="Confirm order"></form><details><summary>Advanced preferences</summary><p>Expanded content</p></details><div id="control-editor" contenteditable="true" aria-label="Message editor"></div><span id="control-switch-label" hidden>Night lighting</span><span id="control-switch" role="switch" tabindex="0" aria-labelledby="control-switch-label" aria-checked="false"></span><button disabled>Unavailable operation</button><button id="background-save">Save account</button><dialog id="control-modal"><p>Edit address</p><button id="modal-save">Save address</button><button id="modal-close">Close editor</button></dialog><section id="aria-modal" role="dialog" aria-modal="true" hidden><button>Save preferences</button></section>';
      document.body.append(fixture);
      document.getElementById('control-form')!.addEventListener('submit', event => {
        event.preventDefault();
        document.body.dataset['orderSubmitted'] = 'yes';
      });
      document
        .getElementById('control-switch')!
        .addEventListener('click', event =>
          (event.currentTarget as HTMLElement).setAttribute('aria-checked', 'true'),
        );
      document.getElementById('modal-save')!.addEventListener('click', () => {
        document.body.dataset['addressSaved'] = 'yes';
      });
      document
        .getElementById('modal-close')!
        .addEventListener('click', () =>
          (document.getElementById('control-modal') as HTMLDialogElement).close(),
        );
    });
    const body = page.locator('body');
    await searchAction(page, 'contact mailbox');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeId(page)).toBe('control-email');
    await searchAction(page, 'weekly digest');
    await expectState(page, 'checkbox · unchecked');
    await page.keyboard.press('Enter');
    await expect(page.locator('#control-check')).toBeChecked();
    await searchAction(page, 'weekly digest');
    await expectState(page, 'checkbox · checked');
    // A page script changing state is reflected live in the open suggestion.
    await page.evaluate(() => {
      const control = document.getElementById('control-check') as HTMLInputElement;
      control.indeterminate = true;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expectState(page, 'checkbox · partially checked');
    await snapshot(page, 'control-state-live');
    await searchAction(page, 'express delivery');
    await expectState(page, 'radio · unselected');
    await page.keyboard.press('Enter');
    await expect(page.locator('#control-radio')).toBeChecked();
    await searchAction(page, 'express delivery');
    await expectState(page, 'radio · selected');
    await searchAction(page, 'confirm order');
    await page.keyboard.press('Enter');
    await expect(body).toHaveAttribute('data-order-submitted', 'yes');
    await searchAction(page, 'advanced preferences');
    await expectState(page, 'disclosure · collapsed');
    await page.keyboard.press('Enter');
    await expect(page.locator('#controls-fixture details')).toHaveAttribute('open', '');
    await searchAction(page, 'advanced preferences');
    await expectState(page, 'disclosure · expanded');
    await searchAction(page, 'message editor');
    await page.keyboard.press('Enter');
    await expect.poll(() => activeId(page)).toBe('control-editor');
    await searchAction(page, 'night lighting');
    await expectState(page, 'switch · off');
    await page.keyboard.press('Enter');
    await expect(page.locator('#control-switch')).toHaveAttribute('aria-checked', 'true');
    await searchAction(page, 'night lighting');
    await expectState(page, 'switch · on');
    await page
      .locator('#control-switch')
      .evaluate(control => control.setAttribute('aria-checked', 'false'));
    await expectState(page, 'switch · off');
    // Disabled controls are listed as unavailable and Enter leaves the query alone.
    await searchAction(page, 'unavailable operation');
    await expect(suggestions).toContainText('unavailable');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('unavailable operation');

    await page.evaluate(() =>
      (document.getElementById('control-modal') as HTMLDialogElement).showModal(),
    );
    await expect.poll(() => hostParent(page)).toBe('control-modal');
    await searchAction(page, 'save');
    await page.keyboard.press('Alt+s');
    await expect(status).toHaveText('Text 1 / 1');
    await expect(options).toHaveCount(1);
    await snapshot(page, 'native-modal-navigation');
    await page.keyboard.press('Enter');
    await expect(body).toHaveAttribute('data-address-saved', 'yes');
    await searchAction(page, 'close editor');
    await page.keyboard.press('Enter');
    await expect.poll(() => hostParent(page)).toBe('body');
    await searchAction(page, 'save account');
    await page.locator('#aria-modal').evaluate(modal => {
      (modal as HTMLElement).hidden = false;
    });
    await expect.poll(() => hostParent(page)).toBe('aria-modal');
    await searchAction(page, 'save');
    await expect(suggestions).toContainText('Save preferences');
    await page.locator('#aria-modal').evaluate(modal => modal.remove());
    await expect.poll(() => hostParent(page)).toBe('body');
    await searchAction(page, 'save account');
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
  for (const scenario of [
    'control-names',
    'control-states',
    'control-states-narrow',
    'transformed-modal',
  ]) {
    const preview = await openPage(context, `${origin}?scenario=${scenario}`);
    try {
      const panel = keymove(preview).suggestions;
      await expect(panel).toBeAttached();
      expect(
        await panel.evaluate(node => node.scrollWidth <= node.clientWidth),
        `${scenario}: result descriptions must not overflow horizontally`,
      ).toBe(true);
      await snapshot(preview, `${scenario}-preview`);
    } catch (error) {
      await attachFailure(preview);
      throw error;
    } finally {
      await preview.close();
    }
  }
}

async function checkTransformedModal(context: BrowserContext, origin: string, native: boolean) {
  const page = await openPage(context, `${origin}fixtures.html?drawer${native ? '&native' : ''}`);
  const { bar, status, host } = keymove(page);
  const kind = native ? 'native' : 'aria';
  try {
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await searchAction(page, 'prix');
    await page.keyboard.press('Alt+s');
    await expect(status).toHaveText(/^Text 1 \//);
    await page.keyboard.press('Tab');
    await expect(host.locator('.keymove-selected-selection')).toBeAttached();
    await snapshot(page, `transformed-${kind}-modal`);
    const geometry = await page.evaluate(() => {
      const drawer = document.getElementById('transformed-drawer')!;
      const root = document.getElementById('keymove-root')!.shadowRoot!;
      const bar = root.querySelector('#keymove-container')!.getBoundingClientRect();
      const outline = root.querySelector('.keymove-selected-selection')!.getBoundingClientRect();
      const target = document.getElementById('price-low')!.getBoundingClientRect();
      return {
        overflow: drawer.scrollWidth - drawer.clientWidth,
        scrollLeft: drawer.scrollLeft,
        barOnScreen: bar.left >= 0 && bar.right <= innerWidth + 1,
        outlineAligned:
          Math.abs(outline.left - (target.left - 7)) <= 1 &&
          Math.abs(outline.top - (target.top - 7)) <= 1,
      };
    });
    expect(
      geometry,
      'Selecting a result must not expand or scroll a transformed drawer, or offset the extension UI',
    ).toEqual({ overflow: 0, scrollLeft: 0, barOnScreen: true, outlineAligned: true });
    expect(
      await page.evaluate(() => {
        const button = document.querySelector('#transformed-drawer button')!;
        const rect = button.getBoundingClientRect();
        return (
          document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) ===
          button
        );
      }),
      'The overlay must not intercept pointer events on the site',
    ).toBe(true);
    await checkStyledToggles(page, native);
    await checkInputValues(page, native);
    // Activation clears the query; restore an active search before testing its Escape.
    await searchAction(page, 'haut - bas');
    await page.keyboard.press('Escape');
    expect(
      await page.evaluate(() => document.getElementById('keymove-root')!.matches(':popover-open')),
      'Escape belongs to KeyMove/page navigation, not popover light dismissal',
    ).toBe(true);
    await page.evaluate(() => {
      const drawer = document.getElementById('transformed-drawer')!;
      if (drawer instanceof HTMLDialogElement) drawer.close();
      else drawer.hidden = true;
    });
    await expect.poll(() => hostParent(page)).toBe('body');
    await expect(page.locator('#keymove-root')).not.toHaveAttribute('popover');
    await searchAction(page, 'apricot');
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}

async function checkInputValues(page: Page, native: boolean) {
  const { status, suggestions } = keymove(page);
  await page.evaluate(
    type => {
      const section = document.createElement('section');
      section.innerHTML =
        '<p>40 €</p><label for="price-minimum">Minimum (EUR)</label><input id="price-minimum" value="10"><label for="price-maximum">Maximum (EUR)</label><input id="price-maximum" type="number">';
      section.querySelector('#price-minimum')!.setAttribute('type', type);
      document.getElementById('transformed-drawer')!.append(section);
      (document.getElementById('price-minimum') as HTMLInputElement).value = '40';
      (document.getElementById('price-maximum') as HTMLInputElement).value = '160';
    },
    native ? 'number' : 'text',
  );
  await searchAction(page, '40');
  await page.keyboard.press('Alt+s');
  await expect(status).toHaveText('Text 1 / 1');
  await page.keyboard.press('Alt+s');
  await page.keyboard.press('Enter');
  const minimum = page.locator('#price-minimum');
  await expect(minimum).toBeFocused();
  // Editors receive focus and keep their own keyboard input.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('5');
  await page.keyboard.press('5');
  await expect(minimum).toHaveValue('55');
  await searchAction(page, '55');
  // A value changed by page script invalidates the indexed value.
  await minimum.evaluate(field => {
    (field as HTMLInputElement).value = '60';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // This checks value invalidation, whether searchAction explicitly selected actions
  // or used the temporary fallback. Mode restoration has its own browser regression.
  await expect(status).toHaveText(/^(Actions|Text) 0 \/ 0$/);
  await searchAction(page, '60', 2); // Also matches the visible maximum value, 160.
  await searchAction(page, 'minimum');
  await expect(suggestions).toContainText('Minimum (EUR) — 60');
  await snapshot(page, `input-value-${native ? 'number' : 'text'}`);
}

async function checkStyledToggles(page: Page, native: boolean) {
  const { status, suggestions } = keymove(page);
  await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('#transformed-drawer ul')!;
    list.innerHTML =
      '<li><label for="price-high-to-low" id="sort-high-label"><input type="radio" name="sorting-rules" id="price-high-to-low" value="price-high-to-low" style="opacity:0;position:absolute"><span aria-hidden="true">◯ </span><span>Prix (Haut - Bas)</span></label><label for="price-high-to-low" aria-hidden="true"></label></li><li><label for="price-low-to-high"><input type="radio" name="sorting-rules" id="price-low-to-high" value="price-low-to-high" checked style="display:none"><span aria-hidden="true">◯ </span><span>Prix (Bas - Haut)</span></label><label for="price-low-to-high" aria-hidden="true"></label></li><li><label><input id="styled-check" type="checkbox" style="opacity:0;position:absolute"><span>Lifestyle</span></label></li>';
    list.dataset['changes'] = '0';
    list.addEventListener('change', () => {
      list.dataset['changes'] = String(Number(list.dataset['changes']) + 1);
    });
  });
  const high = page.locator('#price-high-to-low');
  const low = page.locator('#price-low-to-high');
  await searchAction(page, 'haut - bas');
  await expect(suggestions).toContainText('radio');
  await snapshot(page, `styled-radio-${native ? 'native' : 'aria'}`);
  await page.keyboard.press('Enter');
  await expect(high).toBeChecked();
  await expect(low).not.toBeChecked();
  await searchAction(page, 'bas - haut');
  await page.keyboard.press('Alt+s');
  await expect(status).toHaveText('Text 1 / 1');
  await page.keyboard.press('Enter');
  await expect(high).not.toBeChecked();
  await expect(low).toBeChecked();
  for (const checked of [true, false]) {
    await searchAction(page, 'lifestyle');
    await page.keyboard.press('Enter');
    if (checked) await expect(page.locator('#styled-check')).toBeChecked();
    else await expect(page.locator('#styled-check')).not.toBeChecked();
  }
  await expect(
    page.locator('#transformed-drawer ul'),
    'Each activation emits exactly one native change event',
  ).toHaveAttribute('data-changes', '4');
}
