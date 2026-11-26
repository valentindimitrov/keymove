import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

// The shipped build closes KeyMove's shadow roots (SECURITY.md, "Isolation from the page").
// Locators cannot enter closed roots, so these checks drive KeyMove with real input and
// read only what the page sees, plus the accessibility tree, which includes closed roots.
test.use({ build: 'production' });

type AXNode = {
  nodeId: string;
  role?: { value?: string };
  name?: { value?: string };
  childIds?: string[];
};

/** The status line's text, read from the accessibility tree, which includes closed roots. */
async function statusText(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
    const byId = new Map(nodes.map(node => [node.nodeId, node]));
    const status = nodes.find(node => node.role?.value === 'status');
    if (!status) return null;
    const text: string[] = [];
    const visit = (node: AXNode) => {
      if (node.role?.value === 'StaticText' && node.name?.value) text.push(node.name.value);
      for (const id of node.childIds ?? []) {
        const child = byId.get(id);
        if (child) visit(child);
      }
    };
    visit(status);
    return text.join('').replace(/\s+/g, ' ').trim();
  } finally {
    await cdp.detach();
  }
}

/** The search field's value, read from the accessibility tree. */
async function queryText(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes: (AXNode & { value?: { value?: string } })[];
    };
    return (
      nodes.find(node => node.role?.value === 'combobox' && node.name?.value === 'Search page')
        ?.value?.value ?? null
    );
  } finally {
    await cdp.detach();
  }
}

/** The accessible names of the result rows. */
async function optionNames(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
    return nodes.filter(node => node.role?.value === 'option').map(node => node.name?.value ?? '');
  } finally {
    await cdp.detach();
  }
}

/**
 * Opens search and types `query` until the status matches. Input before KeyMove has read
 * its settings is ignored, and a closed root offers no attribute to wait on instead.
 */
async function search(page: Page, query: string, status: RegExp) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.keyboard.press('Alt+f');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(query);
    const reached = await expect
      .poll(() => statusText(page), { timeout: 2000 })
      .toMatch(status)
      .then(() => true)
      .catch(() => false);
    if (reached) return;
  }
  await expect.poll(() => statusText(page)).toMatch(status);
}

test('page script cannot reach the search interface or results from frames', async ({ page }) => {
  await page.goto('frames.html');
  const cross = page.locator('#cross').contentFrame();
  await expect(cross.locator('#price')).toBeAttached();
  // Results from the page and both frames, including the cross-origin one.
  await search(page, 'otter', /^Text 1 \/ 4$/);
  // The page sees KeyMove's host, but neither its root nor the frame's outline layer.
  expect(
    await page.evaluate(() => {
      const host = document.getElementById('keymove-root');
      return { host: host !== null, root: host?.shadowRoot ?? null };
    }),
  ).toEqual({ host: true, root: null });
  // Chromium's window.find matches text inside closed roots; result text is drawn as
  // generated content so it cannot, while screen readers still get it in each row's name.
  expect(
    await page.evaluate(() => {
      getSelection()?.removeAllRanges();
      // Non-standard, so absent from the DOM types.
      return (window as unknown as { find(text: string): boolean }).find('remote otter paragraph');
    }),
  ).toBe(false);
  await expect
    .poll(() => optionNames(page))
    .toContainEqual(expect.stringContaining('remote otter paragraph'));
  const local = page.locator('iframe').first().contentFrame();
  await expect(local.locator('#keymove-root')).toHaveCount(1);
  expect(await local.locator('#keymove-root').evaluate(marks => marks.shadowRoot)).toBeNull();
});

test('keyboard navigation, selection, copying and activation work through the closed root', async ({
  page,
}) => {
  await page.goto('frames.html');
  const local = page.locator('iframe').first().contentFrame();
  const cross = page.locator('#cross').contentFrame();
  await expect(cross.locator('#launch')).toBeAttached();
  await search(page, 'otter', /^Text 1 \/ 4$/);
  // A focus manager that cancels Tab unless it targets an input sees only KeyMove's host.
  await page.evaluate(() =>
    window.addEventListener(
      'keydown',
      event => {
        if (event.key === 'Tab' && !(event.composedPath()[0] instanceof HTMLInputElement))
          event.preventDefault();
      },
      true,
    ),
  );
  // A page shortcut that cancels letters unless they target an input sees only the host;
  // letters typed in KeyMove still arrive.
  await page.evaluate(() =>
    window.addEventListener(
      'keydown',
      event => {
        if (
          ['j', 's', 'c', 'Backspace', 'ArrowLeft'].includes(event.key) &&
          !(event.composedPath()[0] instanceof HTMLInputElement) &&
          !(event.composedPath()[0] instanceof HTMLTextAreaElement)
        )
          event.preventDefault();
      },
      true,
    ),
  );
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('jotter');
  await expect.poll(() => queryText(page)).toBe('jotter');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('otters');
  await expect.poll(() => queryText(page)).toBe('otters');
  // A recovered Backspace edits the query, and the search follows it.
  await page.keyboard.press('Backspace');
  await expect.poll(() => queryText(page)).toBe('otter');
  await expect.poll(() => statusText(page)).toMatch(/^Text 1 \/ 4$/);
  // Caret keys still move within the query.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('ottr');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('e');
  await expect.poll(() => queryText(page)).toBe('otter');
  await expect.poll(() => statusText(page)).toMatch(/^Text 1 \/ 4$/);
  // Tab reaches KeyMove's shortcut handler from the closed root and selects frame text.
  await page.keyboard.press('Tab');
  await expect
    .poll(() => local.locator('body').evaluate(() => getSelection()?.toString()))
    .toBe('local otter paragraph to copy.');
  // Copying from KeyMove's input copies the selected block, even though the page cancels
  // the keystroke.
  await page.keyboard.press('ControlOrMeta+c');
  await page.evaluate(() => {
    const target = document.createElement('textarea');
    target.id = 'paste';
    document.body.append(target);
  });
  await page.locator('#paste').focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('#paste')).toHaveValue('local otter paragraph to copy.');
  // Typing into a page field stays in that field.
  await page.locator('#paste').fill('');
  await page.keyboard.type('notes');
  await expect(page.locator('#paste')).toHaveValue('notes');
  // Enter activates a button inside the cross-origin frame. Frames answer in their own
  // time, so try each Launch action in turn until that one has been pressed.
  await page.locator('#paste').evaluate(target => target.blur());
  for (let position = 0; position < 3; position++) {
    await page.keyboard.press('Alt+f');
    await page.keyboard.type('Launch');
    await expect.poll(() => statusText(page)).toMatch(/^(Text|Actions) \d+ \/ \d+$/);
    if ((await statusText(page))?.startsWith('Text')) await page.keyboard.press('Alt+s');
    await expect.poll(() => statusText(page)).toMatch(/^Actions \d+ \/ [2-9]$/);
    // Late frame replies re-rank results but keep the current one; settle, then start over.
    await page.waitForTimeout(500);
    const current = Number((await statusText(page))?.match(/^Actions (\d+)/)?.[1] ?? 1);
    for (let step = current; step > 1; step--) await page.keyboard.press('Shift+Tab');
    await expect.poll(() => statusText(page)).toMatch(/^Actions 1 \//);
    for (let step = 0; step < position; step++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    if ((await cross.locator('#result').textContent()) === 'Activated') break;
    await page.waitForTimeout(300);
    if ((await cross.locator('#result').textContent()) === 'Activated') break;
  }
  await expect(cross.locator('#result')).toHaveText('Activated');
});
