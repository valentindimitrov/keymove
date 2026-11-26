import type { BrowserContext, Frame, Locator, Page } from '@playwright/test';
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

const KEYMOVE_HOSTS = () => document.querySelectorAll('#keymove-root').length;

/** Injects the content scripts into the tab at `url` the way background.ts does at installation. */
async function injectContentScripts(manager: Page, extensionId: string, url: string) {
  await expect(async () => {
    await manager.goto(`chrome-extension://${extensionId}/popup.html`);
  }).toPass();
  await manager.evaluate(async url => {
    const api = (
      globalThis as unknown as {
        chrome: {
          tabs: { query(query: object): Promise<{ id?: number; url?: string }[]> };
          scripting: { executeScript(injection: object): Promise<unknown> };
        };
      }
    ).chrome;
    const tab = (await api.tabs.query({})).find(candidate => candidate.url === url);
    if (tab?.id === undefined) throw new Error('fixture tab not found');
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/content.js'],
    });
    await api.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['/content-scripts/frames.js'],
    });
  }, url);
}

/** Reloads the unpacked extension the way chrome://extensions' reload button does. */
async function reloadExtension(context: BrowserContext, extensionId: string) {
  const manager = await context.newPage();
  await manager.goto('chrome://extensions');
  await manager.evaluate(async id => {
    type DeveloperPrivate = {
      updateProfileConfiguration(update: object, done: () => void): void;
      reload(id: string, options: object, done: () => void): void;
    };
    const api = (globalThis as unknown as { chrome: { developerPrivate: DeveloperPrivate } }).chrome
      .developerPrivate;
    await new Promise<void>(done =>
      api.updateProfileConfiguration({ inDeveloperMode: true }, done),
    );
    await new Promise<void>(done => api.reload(id, { failQuietly: true }, done));
  }, extensionId);
  return manager;
}

test('a page cannot retire KeyMove by forging the content-script replacement signal', async ({
  page,
  extensionId,
}) => {
  await page.addInitScript(() => {
    const seen: unknown[] = [];
    Object.defineProperty(window, '__keymoveMessages', { value: seen });
    window.addEventListener('message', event => seen.push(event.data));
  });
  await page.goto('fixtures.html');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-site-behavior', 'type');
  // The started event's type is no longer posted where page script can read it.
  const posted = await page.evaluate(() =>
    JSON.stringify((window as unknown as { __keymoveMessages: unknown[] }).__keymoveMessages),
  );
  expect(posted).not.toContain('content-script-started');
  // The type is predictable from the public extension id, so forge it anyway.
  await page.evaluate(id => {
    for (const name of ['content', 'frames']) {
      document.dispatchEvent(
        new CustomEvent(`${id}:${name}:wxt:content-script-started`, {
          detail: { contentScriptName: name, messageId: 'page-forged-different-id' },
        }),
      );
      document.dispatchEvent(new Event(`keymove:content-script-started:${name}`));
    }
  }, extensionId);
  await page.waitForTimeout(200);
  expect(await page.evaluate(KEYMOVE_HOSTS)).toBe(1);
  await page.keyboard.press('Alt+f');
  const input = page.getByRole('combobox', { name: 'Search page', exact: true });
  await expect(input).toBeFocused();
  await input.pressSequentially('qxyz');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 1');
});

test('mounts beside a page element that already uses the root id and searches it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const impostor = document.createElement('div');
      impostor.id = 'keymove-root';
      impostor.innerHTML = '<p>Impostor quokka paragraph</p>';
      document.body.prepend(impostor);
    });
  });
  const input = await openSearch(page);
  expect(await page.evaluate(KEYMOVE_HOSTS)).toBe(2);
  await input.pressSequentially('quokka');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 1');
  await input.press('Tab');
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe('Impostor quokka paragraph');
});

test('page stylesheets cannot hide, move or cover the searchbar host', async ({ page }) => {
  // Shopify's Dawn theme ships `div:empty { display: none }`, which matched the host:
  // its only content is a shadow root. The rest are generic rules for the last child of
  // body, where the host lives, marked important as a hostile page may.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `
        div:empty { display: none !important; }
        body > div:last-child {
          visibility: hidden !important;
          opacity: 0 !important;
          transform: translateX(-200vw) !important;
          position: relative !important;
          z-index: 0 !important;
        }`;
      document.head.append(style);
    });
  });
  const input = await openSearch(page);
  await input.pressSequentially('qalpha');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 1');
  const bar = page.locator('#keymove-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toBeInViewport();
  expect(
    await page
      .locator('#keymove-root')
      .evaluate(host => [getComputedStyle(host).opacity, getComputedStyle(host).zIndex]),
  ).toEqual(['1', 'auto']);
});

test('page stylesheets cannot hide the result outlines drawn inside frames', async ({ page }) => {
  // Init scripts also run in child frames; each frame's outline layer is an empty div.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'div:empty { display: none !important; }';
      document.head.append(style);
    });
  });
  const input = await openSearch(page, 'frames.html');
  await input.pressSequentially('Launch');
  await expect(page.getByRole('status')).toHaveText(/^(Text|Actions) 1 \/ [1-9]$/);
  const layers = (frame: Frame) =>
    frame.evaluate(() =>
      [...document.querySelectorAll('div')]
        .filter(element => element.shadowRoot?.querySelector('.keymove-selection'))
        .map(element => getComputedStyle(element).display),
    );
  await expect
    .poll(async () => (await Promise.all(page.frames().slice(1).map(layers))).flat())
    .toEqual(expect.arrayContaining(['block']));
  expect((await Promise.all(page.frames().slice(1).map(layers))).flat()).not.toContain('none');
});

test('opens the current address of an iframe link that changed after the search', async ({
  page,
  context,
}) => {
  await page.goto('frames.html');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-always-on', 'true');
  const local = page.locator('iframe').first().contentFrame();
  await local.locator('body').evaluate(body => {
    const link = document.createElement('a');
    link.id = 'quokka';
    link.href = '/fixtures.html?draft';
    link.textContent = 'Quokka notes';
    body.append(link);
  });
  await page.keyboard.press('Alt+f');
  const input = page.getByRole('combobox', { name: 'Search page', exact: true });
  await input.pressSequentially('quokka');
  const status = page.getByRole('status');
  await expect(status).toHaveText(/^(Text|Actions) 1 \/ 1$/);
  if ((await status.innerText()).startsWith('Text')) await input.press('Alt+s');
  await expect(status).toHaveText('Actions 1 / 1');
  // Changed just before the shortcut, sooner than the frame reports the change.
  await local
    .locator('#quokka')
    .evaluate(link => link.setAttribute('href', '/fixtures.html?published'));
  const opened = context.waitForEvent('page');
  await input.press('Shift+Enter');
  const tab = await opened;
  await expect(tab).toHaveURL(/\/fixtures\.html\?published$/);
  await tab.close();
});

test('type-to-search leaves typing in an editor inside a closed shadow root alone', async ({
  page,
}) => {
  // fixtures.html blocks character keys aimed at non-editable targets, such as this host.
  await page.goto('shadow.html');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-always-on', 'true');
  await page.evaluate(() => {
    const host = document.createElement('closed-editor');
    const root = host.attachShadow({ mode: 'closed' });
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.style.minHeight = '2em';
    root.append(editor);
    document.body.prepend(host);
    (window as unknown as { closedEditor: HTMLElement }).closedEditor = editor;
    editor.focus();
  });
  await page.keyboard.type('hello');
  expect(
    await page.evaluate(
      () => (window as unknown as { closedEditor: HTMLElement }).closedEditor.textContent,
    ),
  ).toBe('hello');
  await expect(page.locator('#keymove-input')).toHaveValue('');
});

test('draws outlines only near the viewport, following it as the page scrolls', async ({
  page,
}) => {
  await page.goto('shadow.html');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-always-on', 'true');
  await page.evaluate(() => {
    for (let index = 0; index < 600; index++) {
      const paragraph = document.createElement('p');
      paragraph.textContent = `Quokka paragraph ${index}`;
      document.body.append(paragraph);
    }
  });
  await page.keyboard.press('Alt+f');
  await page.keyboard.type('quokka');
  await expect(page.getByRole('status')).toHaveText(/\/ 600$/);
  // Every outline lies within a screen of the viewport, and some lie on it.
  const placement = () =>
    page.evaluate(() => {
      const root = document.getElementById('keymove-root')!.shadowRoot!;
      const tops = [...root.querySelectorAll('.keymove-selection')].map(
        outline => outline.getBoundingClientRect().top,
      );
      return {
        count: tops.length,
        near: tops.every(top => top >= -2 * innerHeight && top <= 3 * innerHeight),
        onScreen: tops.some(top => top >= 0 && top <= innerHeight),
      };
    });
  await expect.poll(placement).toMatchObject({ near: true, onScreen: true });
  expect((await placement()).count).toBeLessThan(600);
  await page.evaluate(() => window.scrollBy(0, 8000));
  await expect.poll(placement).toMatchObject({ near: true, onScreen: true });
  // Scrolling inside a panel brings its matches into view; they get outlines too.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;width:400px;height:300px;overflow:auto';
    panel.innerHTML = '<div style="height:4000px"></div><p id="deep">Quokka deep in a panel</p>';
    document.body.append(panel);
  });
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('a');
  await expect(page.getByRole('status')).toHaveText(/\/ 601$/);
  await expect(page.locator('#keymove-input')).toHaveValue('quokka');
  // Let the search and its refresh settle, so only the panel's scroll can redraw outlines.
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.getElementById('panel')!.scrollTop = 4000;
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const deep = document.getElementById('deep')!.getBoundingClientRect();
        const root = document.getElementById('keymove-root')!.shadowRoot!;
        return [...root.querySelectorAll('.keymove-selection')].some(
          outline => Math.abs(outline.getBoundingClientRect().top - (deep.top - 7)) < 2,
        );
      }),
    )
    .toBe(true);
  // A carousel that keeps scrolling neither hides the outlines nor remounts them: without
  // a match it refreshes nothing, and with one, outlines move instead of being recreated.
  await page.evaluate(() => {
    const carousel = document.createElement('div');
    carousel.id = 'carousel';
    carousel.style.cssText = 'width:200px;height:50px;overflow:auto';
    carousel.innerHTML = '<div style="height:2000px">slides</div><p>Quokka slide</p>';
    document.body.append(carousel);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const outline of document
      .getElementById('keymove-root')!
      .shadowRoot!.querySelectorAll('.keymove-selection'))
      outline.setAttribute('data-before-carousel', '');
  });
  await page.evaluate(async () => {
    const carousel = document.getElementById('carousel')!;
    for (let step = 1; step <= 5; step++) {
      carousel.scrollTop = step * 100;
      await new Promise(resolve => setTimeout(resolve, 60));
    }
  });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () =>
        document
          .getElementById('keymove-root')!
          .shadowRoot!.querySelectorAll('.keymove-selected-selection[data-before-carousel]').length,
    ),
  ).toBe(1);
});

test('stays out of XML documents such as sitemaps without reporting errors', async ({ page }) => {
  // React DOM threw as it loaded on these, since their elements have no `.style`. The
  // context fixture fails the test on any console error or uncaught exception.
  await page.goto('feed.xml');
  expect(await page.evaluate(() => document.contentType)).toMatch(/xml/);
  await page.waitForLoadState('load');
  // The content script runs at document_idle; give it time to run and fail as it did.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(KEYMOVE_HOSTS)).toBe(0);
  const input = await openSearch(page);
  await input.pressSequentially('qalpha');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 1');
});

test('an orphaned copy retires for the copy injected after an extension reload', async ({
  page,
  context,
  extensionId,
}) => {
  await page.goto('fixtures.html');
  await expect(page.locator('#keymove-bar')).toHaveAttribute('data-site-behavior', 'type');
  // A forged signal beforehand must not stop the genuine retirement later.
  await page.evaluate(id => {
    document.dispatchEvent(
      new CustomEvent(`${id}:content:wxt:content-script-started`, {
        detail: { contentScriptName: 'content', messageId: 'page-forged-different-id' },
      }),
    );
  }, extensionId);
  const pageUrl = page.url();
  const manager = await reloadExtension(context, extensionId);
  // Chromium does not inject manifest scripts into open tabs after a reload: the orphan
  // is still there, with an invalid runtime.
  await page.waitForTimeout(500);
  expect(await page.evaluate(KEYMOVE_HOSTS)).toBe(1);

  // Inject the new copy as background.ts does for tabs open at installation.
  await injectContentScripts(manager, extensionId, pageUrl);
  await manager.close();

  await expect.poll(() => page.evaluate(KEYMOVE_HOSTS)).toBe(1);
  await page.bringToFront();
  await page.keyboard.press('Alt+f');
  const input = page.getByRole('combobox', { name: 'Search page', exact: true });
  await expect(input).toHaveCount(1);
  await expect(input).toBeFocused();
  await input.pressSequentially('qxyz');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 1');
});

test('a copy injected beside a working one neither mounts twice nor duplicates frame results', async ({
  page,
  context,
  extensionId,
}) => {
  const input = await openSearch(page, 'frames.html');
  const manager = await context.newPage();
  await injectContentScripts(manager, extensionId, page.url());
  await manager.close();
  await page.bringToFront();
  expect(await page.evaluate(KEYMOVE_HOSTS)).toBe(1);
  await page.keyboard.press('Alt+f');
  await expect(input).toBeFocused();
  await input.pressSequentially('Launch');
  // Three actions: the page's and one per frame, not a second reply per frame.
  await firstFrameAction(page, input);
  await input.press('Enter');
  await expect(page.frameLocator('iframe[title="Same-origin form"]').locator('#result')).toHaveText(
    'Activated',
  );
});

test('an orphan retires after a reload even when the page blocked every replacement hint', async ({
  page,
  context,
  extensionId,
}) => {
  // In every frame: swallow KeyMove's own started hint before it reaches the document.
  await page.addInitScript(() => {
    for (const name of ['content', 'frames'])
      window.addEventListener(
        `keymove:content-script-started:${name}`,
        event => event.stopImmediatePropagation(),
        true,
      );
  });
  const input = await openSearch(page, 'frames.html');
  await input.press('Escape');
  // Forge WXT's signal while the runtime is valid, so WXT stops listening in every frame.
  for (const frame of page.frames())
    await frame.evaluate(id => {
      for (const name of ['content', 'frames'])
        document.dispatchEvent(
          new CustomEvent(`${id}:${name}:wxt:content-script-started`, {
            detail: { contentScriptName: name, messageId: 'page-forged-different-id' },
          }),
        );
    }, extensionId);
  expect(await page.evaluate(KEYMOVE_HOSTS)).toBe(1);
  const pageUrl = page.url();
  const manager = await reloadExtension(context, extensionId);
  await injectContentScripts(manager, extensionId, pageUrl);
  await manager.close();

  await expect.poll(() => page.evaluate(KEYMOVE_HOSTS)).toBe(1);
  await page.bringToFront();
  await page.keyboard.press('Alt+f');
  const fresh = page.getByRole('combobox', { name: 'Search page', exact: true });
  await expect(fresh).toHaveCount(1);
  await expect(fresh).toBeFocused();
  await fresh.pressSequentially('Launch');
  // One reply per frame: the orphaned helpers retired instead of answering too.
  await firstFrameAction(page, fresh);
  await fresh.press('Enter');
  await expect(page.frameLocator('iframe[title="Same-origin form"]').locator('#result')).toHaveText(
    'Activated',
  );
});

// Simulation, not Firefox: Firefox destroys an old copy's sandbox on reload and leaves its
// DOM. Here a genuine host is built by a copy in a same-origin child frame, moved into the
// top document, and the frame removed, so no script remains behind that host.
test('a copy injected after a reload removes a host whose own script is gone, not page impostors', async ({
  page,
  context,
  extensionId,
}) => {
  const input = await openSearch(page, 'frames.html');
  await input.press('Escape');
  const manager = await context.newPage();
  await expect(async () => {
    await manager.goto(`chrome-extension://${extensionId}/popup.html`);
  }).toPass();
  const pageUrl = page.url();
  await manager.evaluate(async url => {
    type Injection = { frameId: number; result?: unknown };
    const api = (
      globalThis as unknown as {
        chrome: {
          tabs: { query(query: object): Promise<{ id?: number; url?: string }[]> };
          scripting: { executeScript(injection: object): Promise<Injection[]> };
        };
      }
    ).chrome;
    const tab = (await api.tabs.query({})).find(candidate => candidate.url === url);
    if (tab?.id === undefined) throw new Error('fixture tab not found');
    const frames = await api.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => location.href,
    });
    const child = frames.find(frame =>
      String(frame.result).includes('frame-child.html?name=local'),
    );
    if (!child) throw new Error('same-origin child frame not found');
    await api.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [child.frameId] },
      files: ['/content-scripts/content.js'],
    });
  }, pageUrl);
  const frame = page.locator('iframe[title="Same-origin form"]');
  await expect
    .poll(() =>
      frame.evaluate(
        (element: HTMLIFrameElement) =>
          element.contentDocument?.querySelectorAll('#keymove-root').length,
      ),
    )
    .toBe(1);
  // The copy signs its host once its storage read completes; page script cannot see that.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Same-origin form"]')!;
    document.body.append(iframe.contentDocument!.querySelector('#keymove-root')!);
    iframe.remove();
    // A page impostor with KeyMove's shape and a closed-root marker of its own.
    const impostor = document.createElement('div');
    impostor.id = 'keymove-root';
    impostor.dataset.impostor = '';
    const shadow = impostor.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style></style><div id="keymove-app"></div><div id="keymove-portal"></div>';
    const marker = document.createElement('span');
    marker.attachShadow({
      mode: 'closed',
    }).innerHTML = `<span data-keymove-secret="${'0'.repeat(32)}"></span>`;
    shadow.append(marker);
    document.body.append(impostor);
  });
  expect(await page.evaluate(KEYMOVE_HOSTS)).toBe(3);

  await manager.close();
  const reloader = await reloadExtension(context, extensionId);
  await injectContentScripts(reloader, extensionId, pageUrl);
  await reloader.close();

  // The new copy's host and the impostor remain; the orphan and the dead host are gone.
  await expect.poll(() => page.evaluate(KEYMOVE_HOSTS)).toBe(2);
  expect(await page.evaluate(() => document.querySelector('[data-impostor]')?.isConnected)).toBe(
    true,
  );
  await page.bringToFront();
  await page.keyboard.press('Alt+f');
  const fresh = page.getByRole('combobox', { name: 'Search page', exact: true });
  await expect(fresh).toHaveCount(1);
  await expect(fresh).toBeFocused();
  await fresh.pressSequentially('lighthouse');
  await expect(page.getByRole('status')).toHaveText('Text 1 / 1');
});
