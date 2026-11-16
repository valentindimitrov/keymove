import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

async function openSearch(page: Page, fixture = 'fixtures.html') {
  await page.goto(fixture);
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-always-on', 'true');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-site-behavior', 'type');
  await page.keyboard.press('Alt+f');
  const input = page.getByRole('combobox', { name: 'Search page', exact: true });
  await expect(input).toBeFocused();
  return input;
}

async function firstFrameAction(page: Page, input: Locator) {
  const status = page.getByRole('status');
  await expect(status).toHaveText(/^(Text|Actions) [1-9] \/ [1-9]$/);
  if ((await status.innerText()).startsWith('Text')) await input.press('Alt+s');
  await expect(status).toHaveText(/^Actions [1-3] \/ 3$/);
  // Streamed frame replies retain the current node, which can change its rank.
  const position = Number((await status.innerText()).match(/Actions (\d+)/)?.[1]);
  for (let index = position; index > 1; index--) await input.press('Shift+Tab');
  await expect(status).toHaveText('Actions 1 / 3');
}

for (const size of ['small', 'large']) {
  test(`searches on each keystroke and copies the whole block (${size} page)`, async ({ page }) => {
    const input = await openSearch(page, `fixtures.html?size=${size}`);
    const status = page.getByRole('status');
    for (const [character, count] of [
      ['q', 4],
      ['x', 3],
      ['y', 2],
      ['z', 1],
    ] as const) {
      await input.press(character);
      await expect(status).toHaveText(`Text 1 / ${count}`);
    }
    await input.press('Tab');
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('qxyzdelta whole semantic block for copying.');
    await input.press('ControlOrMeta+c');
    await input.press('d');
    await expect(input).toHaveValue('qxyzd');
    const paste = page.getByRole('textbox', { name: 'Native paste target' });
    await paste.focus();
    await paste.press('ControlOrMeta+v');
    await expect(paste).toHaveValue('qxyzdelta whole semantic block for copying.');
    await page.keyboard.press('Alt+f');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
  });
}

test('refreshes an active query when page text is inserted and removed', async ({ page }) => {
  const input = await openSearch(page);
  await input.pressSequentially('mango');
  await expect(page.getByRole('status')).toHaveText('Text ~ 0 / 0');
  await page.locator('#dynamic').evaluate(element => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'mango added later';
    element.append(paragraph);
  });
  await expect(page.getByRole('status')).toHaveText('Text 0 / 1');
  await page.locator('#dynamic').evaluate(element => element.replaceChildren());
  await expect(page.getByRole('status')).toHaveText('Text ~ 0 / 0');
});

test('activates a control inside a nested open shadow root', async ({ page }) => {
  const input = await openSearch(page, 'shadow.html');
  await input.pressSequentially('Nested ignition');
  await input.press('Alt+s');
  await expect(page.getByRole('status')).toHaveText('Actions 1 / 1');
  await input.press('Enter');
  await expect(page.locator('#component')).toHaveAttribute('data-nested', 'yes');
});

test('keeps search and native selection inside a modal dialog', async ({ page }) => {
  const input = await openSearch(page, 'fixtures.html?drawer&native');
  await input.pressSequentially('Prix');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 3');
  await expect(
    page.getByRole('dialog', { name: 'Sort products' }).locator('#keymove-root'),
  ).toHaveCount(1);
  await input.press('Tab');
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toMatch(/^Prix \(/);
  await input.press('ControlOrMeta+a');
  await input.pressSequentially('qxyzdelta');
  await expect(page.getByRole('status')).toHaveText('Text ~ 0 / 0');
});

test('searches and activates actions in same-origin and cross-origin frames', async ({ page }) => {
  const input = await openSearch(page, 'frames.html');
  const local = page.frameLocator('iframe[title="Same-origin form"]');
  const cross = page.frameLocator('#cross');
  await expect(local.getByRole('button', { name: 'Launch', exact: true })).toBeVisible();
  await expect(cross.getByRole('button', { name: 'Launch', exact: true })).toBeVisible();
  await input.pressSequentially('Launch');
  await firstFrameAction(page, input);
  await input.press('Enter');
  await expect(local.locator('#result')).toHaveText('Activated');
  await page.keyboard.press('Alt+f');
  await expect(input).toHaveValue('');
  await input.pressSequentially('Launch');
  await firstFrameAction(page, input);
  await input.press('Tab');
  await input.press('Enter');
  await expect(cross.locator('#result')).toHaveText('Activated');
  await expect(page.locator('#keymove-root')).toHaveCount(1);
});

test('settings changes persist and reach an already open page', async ({
  page,
  context,
  extensionId,
}) => {
  const input = await openSearch(page);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('combobox', { name: 'Default activation' }).selectOption('shortcut');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-always-on', 'false');
  await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
  await popup.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  await expect(page.locator('#keymove-root')).toHaveAttribute('data-keymove-theme', 'dark');
  await popup.reload();
  await expect(popup.getByRole('combobox', { name: 'Default activation' })).toHaveValue('shortcut');
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await page.keyboard.press('q');
  await expect(page.locator('#keymove-input')).toHaveValue('');
  await page.keyboard.press('Alt+f');
  await expect(input).toBeFocused();
  await input.pressSequentially('qxyz');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 1');
});

test('ignores page-dispatched keyboard and input events while real input still works', async ({
  page,
  context,
}) => {
  await page.goto('fixtures.html');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-site-behavior', 'type');
  const input = page.getByRole('combobox', { name: 'Search page', exact: true });
  // The hostile page adds its own link, then drives KeyMove with synthetic events.
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/fixtures.html?opened';
    link.textContent = 'Zephyr destination';
    link.addEventListener('click', event => {
      event.preventDefault();
      link.dataset['clicks'] = String(Number(link.dataset['clicks'] ?? 0) + 1);
    });
    document.body.append(link);
    const key = (target: EventTarget, init: KeyboardEventInit) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, composed: true, ...init }),
      );
    key(document.body, { key: 'z', code: 'KeyZ' });
    key(document.body, { key: 'f', code: 'KeyF', altKey: true });
    const field = document
      .getElementById('keymove-root')!
      .shadowRoot!.querySelector<HTMLInputElement>('#keymove-input')!;
    field.value = 'Zephyr';
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  // The bar stays hidden, so its input is absent from the accessibility tree.
  const field = page.locator('#keymove-input');
  await expect(field).not.toBeFocused();
  await expect(field).toHaveValue('');

  await page.keyboard.press('Alt+f');
  await expect(input).toBeFocused();
  await input.pressSequentially('Zephyr');
  await input.press('Alt+s');
  await expect(page.getByRole('status')).toHaveText('Actions 1 / 1');
  const pagesBefore = context.pages().length;
  await page.evaluate(() => {
    const field = document
      .getElementById('keymove-root')!
      .shadowRoot!.querySelector<HTMLInputElement>('#keymove-input')!;
    for (const modifiers of [{}, { shiftKey: true }, { ctrlKey: true }])
      field.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
          composed: true,
          ...modifiers,
        }),
      );
    field.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  });
  const link = page.getByRole('link', { name: 'Zephyr destination' });
  // A synthetic Shift/Ctrl+Enter would ask the background for a tab asynchronously.
  await page.waitForTimeout(500);
  expect(context.pages()).toHaveLength(pagesBefore);
  await expect(link).not.toHaveAttribute('data-clicks');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Actions 1 / 1');

  const opened = context.waitForEvent('page');
  await input.press('Shift+Enter');
  const tab = await opened;
  await expect(tab).toHaveURL(/\/fixtures\.html\?opened$/);
  await tab.close();
  await page.bringToFront();
  await page.keyboard.press('Alt+f');
  await input.pressSequentially('Zephyr');
  await input.press('Alt+s');
  await expect(page.getByRole('status')).toHaveText('Actions 1 / 1');
  await input.press('Enter');
  await expect(link).toHaveAttribute('data-clicks', '1');
});

test('page-dispatched focus, blur and mouse events cannot steer a real search or drag', async ({
  page,
  context,
}) => {
  await page.goto('fixtures.html');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-site-behavior', 'type');
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/fixtures.html?opened';
    link.textContent = 'Zephyr destination';
    link.addEventListener('click', event => {
      event.preventDefault();
      link.dataset['clicks'] = String(Number(link.dataset['clicks'] ?? 0) + 1);
    });
    document.body.append(link);
  });
  await page.keyboard.press('Alt+f');
  const input = page.getByRole('combobox', { name: 'Search page', exact: true });
  await expect(input).toBeFocused();
  await input.pressSequentially('Zephyr');
  await input.press('Alt+s');
  const status = page.locator('#keymove-matches-summary');
  await expect(status).toHaveText('Actions 1 / 1');

  // A synthetic focusout claims focus left for the page; it never did.
  await page.evaluate(() =>
    document
      .getElementById('keymove-root')!
      .shadowRoot!.querySelector('#keymove-input')!
      .dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: document.body }),
      ),
  );
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Zephyr');
  await expect(status).toHaveText('Actions 1 / 1');

  // While the user drags the bar, page mouse events must not move or commit it.
  const bar = page.locator('#keymove-container');
  const place = () =>
    bar.evaluate(element => ({
      left: Number.parseFloat((element as HTMLElement).style.left),
      top: Number.parseFloat((element as HTMLElement).style.top),
    }));
  const box = (await bar.boundingBox())!;
  const before = await place();
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.evaluate(() => {
    for (const type of ['mousemove', 'mouseup'])
      document.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
      );
  });
  expect(await place()).toEqual(before);
  await page.mouse.move(box.x + 48, box.y + 8);
  await page.mouse.up();
  // The real drag continues from where the user grabbed the bar.
  expect(await place()).toEqual({ left: before.left + 40, top: before.top });
  await expect(input).toHaveValue('Zephyr');

  // A synthetic focusin on another menu item must not change what a real Enter runs.
  await input.focus();
  await input.press('ArrowDown');
  const openLink = page.getByRole('menuitem', { name: 'Open link' });
  await expect(openLink).toBeFocused();
  await page.evaluate(() => {
    const items = document
      .getElementById('keymove-root')!
      .shadowRoot!.querySelectorAll<HTMLElement>('[role="menuitem"]');
    const newTab = [...items].find(item => item.textContent?.includes('Open in new tab'))!;
    newTab.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  });
  await expect(openLink).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(1);
  const pagesBefore = context.pages().length;
  await page.keyboard.press('Enter');
  const link = page.getByRole('link', { name: 'Zephyr destination' });
  await expect(link).toHaveAttribute('data-clicks', '1');
  await page.waitForTimeout(500);
  expect(context.pages()).toHaveLength(pagesBefore);
});
