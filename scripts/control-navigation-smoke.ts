import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const status = `${shadow}?.querySelector('[role="status"]')?.textContent`;

async function expectState(page: TestPage, state: string) {
  await waitFor(
    page,
    `${shadow}?.querySelector('[role="listbox"]')?.textContent.includes(${JSON.stringify(state)})`,
  );
}

async function searchAction(page: TestPage, query: string, count = 1) {
  await page.key('f', 1);
  await waitFor(page, `${shadow}.activeElement === ${input}`);
  await page.key('Backspace', process.platform === 'darwin' ? 4 : 2);
  for (const character of query) await page.key(character);
  await waitFor(page, `${input}?.value === ${JSON.stringify(query)}`);
  if (query.length >= 3) {
    await waitFor(
      page,
      `${shadow}.querySelector('[role="listbox"]')?.getAttribute('aria-busy') === 'false'`,
    );
  } else {
    await waitFor(page, `${status}?.startsWith('Text') || ${status}?.startsWith('Actions')`);
  }
  if (((await page.evaluate(status)) as string).startsWith('Text')) await page.key('s', 1);
  await waitFor(page, `${status} === 'Actions 1 / ${count}'`);
}

export async function checkControlNavigation(client: ChromiumClient, origin: string) {
  const artifacts = path.resolve(import.meta.dirname, '../.artifacts');
  mkdirSync(artifacts, { recursive: true });
  await checkTransformedModal(client, origin, artifacts, false);
  await checkTransformedModal(client, origin, artifacts, true);
  const page = await openPage(client, `${origin}fixtures.html?controls`);
  try {
    await page.activate();
    await waitFor(page, `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`);
    await page.evaluate(`(() => {
      const fixture = document.createElement('section');
      fixture.id = 'controls-fixture';
      fixture.innerHTML = '<label for="control-email">Contact mailbox</label><input id="control-email"><label>Weekly digest<input id="control-check" type="checkbox"></label><label>Express delivery<input id="control-radio" type="radio"></label><form id="control-form"><input type="submit" value="Confirm order"></form><details><summary>Advanced preferences</summary><p>Expanded content</p></details><div id="control-editor" contenteditable="true" aria-label="Message editor"></div><span id="control-switch-label" hidden>Night lighting</span><span id="control-switch" role="switch" tabindex="0" aria-labelledby="control-switch-label" aria-checked="false"></span><button disabled>Unavailable operation</button><button id="background-save">Save account</button><dialog id="control-modal"><p>Edit address</p><button id="modal-save">Save address</button><button id="modal-close">Close editor</button></dialog><section id="aria-modal" role="dialog" aria-modal="true" hidden><button>Save preferences</button></section>';
      document.body.append(fixture);
      document.getElementById('control-form').addEventListener('submit', e => { e.preventDefault(); document.body.dataset.orderSubmitted = 'yes'; });
      document.getElementById('control-switch').addEventListener('click', e => e.currentTarget.setAttribute('aria-checked', 'true'));
      document.getElementById('modal-save').addEventListener('click', () => document.body.dataset.addressSaved = 'yes');
      document.getElementById('modal-close').addEventListener('click', () => document.getElementById('control-modal').close());
    })()`);
    await searchAction(page, 'contact mailbox');
    await page.key('Enter');
    assert.equal(await page.evaluate('document.activeElement.id'), 'control-email');
    await searchAction(page, 'weekly digest');
    await expectState(page, 'checkbox · unchecked');
    await page.key('Enter');
    assert.equal(await page.evaluate(`document.getElementById('control-check').checked`), true);
    await searchAction(page, 'weekly digest');
    await expectState(page, 'checkbox · checked');
    await page.evaluate(`(() => {
      const control = document.getElementById('control-check');
      control.indeterminate = true;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await expectState(page, 'checkbox · partially checked');
    writeFileSync(path.join(artifacts, 'control-state-live.png'), await page.screenshot());
    await searchAction(page, 'express delivery');
    await expectState(page, 'radio · unselected');
    await page.key('Enter');
    assert.equal(await page.evaluate(`document.getElementById('control-radio').checked`), true);
    await searchAction(page, 'express delivery');
    await expectState(page, 'radio · selected');
    await searchAction(page, 'confirm order');
    await page.key('Enter');
    assert.equal(await page.evaluate('document.body.dataset.orderSubmitted'), 'yes');
    await searchAction(page, 'advanced preferences');
    await expectState(page, 'disclosure · collapsed');
    await page.key('Enter');
    assert.equal(
      await page.evaluate(`document.querySelector('#controls-fixture details').open`),
      true,
    );
    await searchAction(page, 'advanced preferences');
    await expectState(page, 'disclosure · expanded');
    await searchAction(page, 'message editor');
    await page.key('Enter');
    assert.equal(await page.evaluate('document.activeElement.id'), 'control-editor');
    await searchAction(page, 'night lighting');
    await expectState(page, 'switch · off');
    await page.key('Enter');
    assert.equal(
      await page.evaluate(`document.getElementById('control-switch').getAttribute('aria-checked')`),
      'true',
    );
    await searchAction(page, 'night lighting');
    await expectState(page, 'switch · on');
    await page.evaluate(
      `document.getElementById('control-switch').setAttribute('aria-checked', 'false')`,
    );
    await expectState(page, 'switch · off');
    await searchAction(page, 'unavailable operation');
    assert.match(
      (await page.evaluate(`${shadow}.querySelector('[role="listbox"]').textContent`)) as string,
      /unavailable/,
    );
    await page.key('Enter');
    assert.equal(await page.evaluate(`${input}.value`), 'unavailable operation');

    await page.evaluate(`document.getElementById('control-modal').showModal()`);
    await waitFor(
      page,
      `document.getElementById('keymove-root').parentElement.id === 'control-modal'`,
    );
    await searchAction(page, 'save');
    await page.key('s', 1);
    await waitFor(page, `${status} === 'Text 1 / 1'`);
    assert.equal(await page.evaluate(`${shadow}.querySelectorAll('[role="option"]').length`), 1);
    writeFileSync(path.join(artifacts, 'native-modal-navigation.png'), await page.screenshot());
    await page.key('Enter');
    assert.equal(await page.evaluate('document.body.dataset.addressSaved'), 'yes');
    await searchAction(page, 'close editor');
    await page.key('Enter');
    await waitFor(page, `document.getElementById('keymove-root').parentElement === document.body`);
    await searchAction(page, 'save account');
    await page.evaluate(`document.getElementById('aria-modal').hidden = false`);
    await waitFor(
      page,
      `document.getElementById('keymove-root').parentElement.id === 'aria-modal'`,
    );
    await searchAction(page, 'save');
    assert.match(
      (await page.evaluate(`${shadow}.querySelector('[role="listbox"]').textContent`)) as string,
      /Save preferences/,
    );
    await page.evaluate(`document.getElementById('aria-modal').remove()`);
    await waitFor(page, `document.getElementById('keymove-root').parentElement === document.body`);
    await searchAction(page, 'save account');
  } finally {
    await page.close();
  }
  for (const scenario of [
    'control-names',
    'control-states',
    'control-states-narrow',
    'transformed-modal',
  ]) {
    const preview = await openPage(client, `${origin}?scenario=${scenario}`);
    try {
      await preview.activate();
      await waitFor(preview, `${shadow}?.querySelector('[role="listbox"]')`);
      assert.equal(
        await preview.evaluate(`(() => {
        const panel = ${shadow}.querySelector('[role="listbox"]');
        return panel.scrollWidth <= panel.clientWidth;
      })()`),
        true,
        `${scenario}: result descriptions must not overflow horizontally`,
      );
      writeFileSync(path.join(artifacts, `${scenario}-preview.png`), await preview.screenshot());
    } finally {
      await preview.close();
    }
  }
}

async function checkTransformedModal(
  client: ChromiumClient,
  origin: string,
  artifacts: string,
  native: boolean,
) {
  const page = await openPage(client, `${origin}fixtures.html?drawer${native ? '&native' : ''}`);
  try {
    await page.activate();
    await waitFor(page, `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`);
    await searchAction(page, 'prix');
    await page.key('s', 1);
    await waitFor(page, `${status}?.startsWith('Text 1 /')`);
    await page.key('Tab');
    await waitFor(page, `${shadow}.querySelector('.keymove-selected-selection')`);
    writeFileSync(
      path.join(artifacts, `transformed-${native ? 'native' : 'aria'}-modal.png`),
      await page.screenshot(),
    );
    const geometry = await page.evaluate(`(() => {
      const drawer = document.getElementById('transformed-drawer');
      const root = ${shadow};
      const bar = root.querySelector('#keymove-container').getBoundingClientRect();
      const outline = root.querySelector('.keymove-selected-selection').getBoundingClientRect();
      const target = document.getElementById('price-low').getBoundingClientRect();
      return { overflow: drawer.scrollWidth - drawer.clientWidth, scrollLeft: drawer.scrollLeft,
        barOnScreen: bar.left >= 0 && bar.right <= innerWidth + 1,
        outlineAligned: Math.abs(outline.left - (target.left - 7)) <= 1 && Math.abs(outline.top - (target.top - 7)) <= 1 };
    })()`);
    assert.deepEqual(
      geometry,
      { overflow: 0, scrollLeft: 0, barOnScreen: true, outlineAligned: true },
      'Selecting a result must not expand or scroll a transformed drawer, or offset the extension UI',
    );
    assert.equal(
      await page.evaluate(`(() => {
      const button = document.querySelector('#transformed-drawer button');
      const rect = button.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === button;
    })()`),
      true,
      'The overlay must not intercept pointer events on the site',
    );
    await checkStyledToggles(page, artifacts, native);
    await checkInputValues(page, artifacts, native);
    // Activation clears the query; restore an active search before testing its Escape.
    await searchAction(page, 'haut - bas');
    await page.key('Escape');
    assert.equal(
      await page.evaluate(`document.getElementById('keymove-root').matches(':popover-open')`),
      true,
      'Escape belongs to KeyMove/page navigation, not popover light dismissal',
    );
    await page.evaluate(`(() => {
      const drawer = document.getElementById('transformed-drawer');
      if (drawer instanceof HTMLDialogElement) drawer.close();
      else drawer.hidden = true;
    })()`);
    await waitFor(page, `document.getElementById('keymove-root').parentElement === document.body`);
    assert.equal(
      await page.evaluate(`document.getElementById('keymove-root').hasAttribute('popover')`),
      false,
    );
    await searchAction(page, 'apricot');
  } finally {
    await page.close();
  }
}

async function checkInputValues(page: TestPage, artifacts: string, native: boolean) {
  await page.evaluate(`(() => {
    const section = document.createElement('section');
    section.innerHTML = '<p>40 €</p><label for="price-minimum">Minimum (EUR)</label><input id="price-minimum" type="${native ? 'number' : 'text'}" value="10"><label for="price-maximum">Maximum (EUR)</label><input id="price-maximum" type="number">';
    document.getElementById('transformed-drawer').append(section);
    document.getElementById('price-minimum').value = '40';
    document.getElementById('price-maximum').value = '160';
  })()`);
  await searchAction(page, '40');
  await page.key('s', 1);
  await waitFor(page, `${status} === 'Text 1 / 1'`);
  await page.key('s', 1);
  await page.key('Enter');
  assert.equal(await page.evaluate('document.activeElement.id'), 'price-minimum');
  await page.key('a', process.platform === 'darwin' ? 4 : 2);
  await page.key('5');
  await page.key('5');
  assert.equal(await page.evaluate(`document.getElementById('price-minimum').value`), '55');
  await searchAction(page, '55');
  await page.evaluate(`(() => {
    const minimum = document.getElementById('price-minimum');
    minimum.value = '60';
    minimum.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await waitFor(page, `${status} === 'Actions 0 / 0'`);
  await searchAction(page, '60', 2); // Also matches the visible maximum value, 160.
  await searchAction(page, 'minimum');
  assert.match(
    (await page.evaluate(`${shadow}.querySelector('[role="listbox"]').textContent`)) as string,
    /Minimum \(EUR\) — 60/,
  );
  writeFileSync(
    path.join(artifacts, `input-value-${native ? 'number' : 'text'}.png`),
    await page.screenshot(),
  );
}

async function checkStyledToggles(page: TestPage, artifacts: string, native: boolean) {
  await page.evaluate(`(() => {
    const list = document.querySelector('#transformed-drawer ul');
    list.innerHTML = '<li><label for="price-high-to-low" id="sort-high-label"><input type="radio" name="sorting-rules" id="price-high-to-low" value="price-high-to-low" style="opacity:0;position:absolute"><span aria-hidden="true">◯ </span><span>Prix (Haut - Bas)</span></label><label for="price-high-to-low" aria-hidden="true"></label></li><li><label for="price-low-to-high"><input type="radio" name="sorting-rules" id="price-low-to-high" value="price-low-to-high" checked style="display:none"><span aria-hidden="true">◯ </span><span>Prix (Bas - Haut)</span></label><label for="price-low-to-high" aria-hidden="true"></label></li><li><label><input id="styled-check" type="checkbox" style="opacity:0;position:absolute"><span>Lifestyle</span></label></li>';
    list.dataset.changes = '0';
    list.addEventListener('change', () => list.dataset.changes = String(Number(list.dataset.changes) + 1));
  })()`);
  await searchAction(page, 'haut - bas');
  assert.match(
    (await page.evaluate(`${shadow}.querySelector('[role="listbox"]').textContent`)) as string,
    /radio/,
  );
  writeFileSync(
    path.join(artifacts, `styled-radio-${native ? 'native' : 'aria'}.png`),
    await page.screenshot(),
  );
  await page.key('Enter');
  assert.equal(
    await page.evaluate(
      `document.getElementById('price-high-to-low').checked && !document.getElementById('price-low-to-high').checked`,
    ),
    true,
  );
  await searchAction(page, 'bas - haut');
  await page.key('s', 1);
  await waitFor(page, `${status} === 'Text 1 / 1'`);
  await page.key('Enter');
  assert.equal(
    await page.evaluate(
      `!document.getElementById('price-high-to-low').checked && document.getElementById('price-low-to-high').checked`,
    ),
    true,
  );
  for (const checked of [true, false]) {
    await searchAction(page, 'lifestyle');
    await page.key('Enter');
    assert.equal(await page.evaluate(`document.getElementById('styled-check').checked`), checked);
  }
  assert.equal(
    await page.evaluate(`document.querySelector('#transformed-drawer ul').dataset.changes`),
    '4',
    'Each activation emits exactly one native change event',
  );
}
