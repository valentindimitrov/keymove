import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser, createPreviewCopy } from './preview-extension.ts';
import { openPage, waitFor, boundedClient } from './browser-driver.ts';
const artifacts = new URL('../.artifacts/pattern-recordings/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), 'keymove-website-profile-'));
const base = process.argv[2] ?? 'http://127.0.0.1:5182/';
const preview = createPreviewCopy(path.resolve('.output/chrome-mv3'));
const child = spawn(
  findBrowser('vivaldi').binary,
  [
    '--headless=new',
    '--disable-extensions-except=' + preview.directory,
    '--load-extension=' + preview.directory,
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--window-size=1440,1000',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket;
try {
  for (let i = 0; i < 100 && !existsSync(`${profile}/DevToolsActivePort`); i++) await delay(100);
  const [port, endpoint] = readFileSync(`${profile}/DevToolsActivePort`, 'utf8').trim().split('\n');
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  socket.onmessage = e => {
    const result = JSON.parse(e.data);
    if (result.id) {
      const p = pending.get(result.id);
      pending.delete(result.id);
      result.error ? p.reject(result.error) : p.resolve(result.result);
    }
  };
  const client = boundedClient({
    sendCommand(method, params, sessionId) {
      return new Promise((resolve, reject) => {
        const request = ++id;
        pending.set(request, { resolve, reject });
        socket.send(JSON.stringify({ id: request, method, params, sessionId }));
      });
    },
  });

  let targets;
  for (let i = 0; i < 100; i++) {
    targets = await client.sendCommand('Target.getTargets', {});
    if (
      targets.targetInfos.some(t => t.type === 'service_worker' && t.url.endsWith('/background.js'))
    )
      break;
    await delay(100);
  }

  const worker = targets.targetInfos.find(
    t => t.type === 'service_worker' && t.url.endsWith('/background.js'),
  );
  if (!worker) throw new Error('No installed extension worker');
  const popup = await openPage(client, new URL('popup.html', worker.url).href);
  await popup.evaluate(
    "chrome.storage.local.set({autoHide:false,alwaysOn:false,theme:'light',popupPosition:{x:.5,y:.68},popupWidth:510})",
  );
  const font = [
    process.env.KEYMOVE_RECORDING_FONT,
    'C:/Windows/Fonts/arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ].find(p => p && existsSync(p));
  if (!font) throw new Error('Set KEYMOVE_RECORDING_FONT to an installed TrueType font.');
  const output = path.resolve('website/media/patterns');
  mkdirSync(output, { recursive: true });
  const root = "document.getElementById('keymove-root').shadowRoot";
  const input = `${root}.querySelector('input')`;
  const status = `${root}.querySelector('[role=status]')?.textContent`;
  const selected = `${root}.querySelector('.keymove-suggestion-selected')?.textContent`;
  const report = existsSync(new URL('verification.json', artifacts))
    ? JSON.parse(readFileSync(new URL('verification.json', artifacts), 'utf8'))
    : [];
  let page, frames, directory, title, caption, keys, time;
  const evidence = [];
  const check = async (expression, label) => {
    await waitFor(page, expression);
    evidence.push(label);
  };
  const capture = async (duration = 1.3) => {
    await delay(130);
    const filename = `${String(frames.length).padStart(4, '0')}.png`;
    writeFileSync(path.join(directory, filename), await page.screenshot());
    frames.push({ filename, duration, start: time, caption, keys });
    time += duration;
  };
  const press = async (key, modifiers = 0, label = key, description = caption, hold = 1.2) => {
    keys = label;
    caption = description;
    await page.key(key, modifiers);
    await delay(230);
    await capture(hold);
  };
  const type = async (text, description = 'Type the words you see') => {
    caption = description;
    for (const c of text) {
      keys = c === ' ' ? 'Space' : c;
      await page.key(c);
      await capture(0.1);
    }
    keys = text;
    await check(
      `${input}.value===${JSON.stringify(text)} && !!${root}.querySelector('.keymove-suggestion')`,
      'Query returned real results',
    );
    await capture(1.7);
  };
  const search = async (query, actions = false) => {
    await press('f', 1, 'Alt / Option + F', 'Open KeyMove', 0.8);
    if (actions) await press('s', 1, 'Alt / Option + S', 'Switch to action mode', 0.8);
    await type(query);
  };
  const menu = async () => {
    await press('ArrowDown', 0, 'Down', 'See the available actions');
    await check(`!!${root}.querySelector('[role=menu]')`, 'Action menu opened');
  };
  const choose = async label => {
    const labels = await page.evaluate(
      `Array.from(${root}.querySelectorAll('[role=menuitem]')).map(e=>e.textContent)`,
    );
    const index = labels.findIndex(text => text.includes(label));
    if (index < 0) throw new Error(`Missing menu action: ${label}`);
    for (let i = 0; i < index; i++) await press('ArrowDown', 0, 'Down', `Choose ${label}`, 0.35);
    await press('Enter', 0, 'Enter', label, 1.7);
  };
  const scrollSetup = async selector => {
    await page.evaluate(
      `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`,
    );
    await delay(200);
  };
  const plan = [
    [
      'jump-to-text',
      'Jump to text',
      async () => {
        await search('river bend');
        await press('1', 1, 'Alt / Option + 1', 'Jump to the selected passage');
        await check(
          'scrollY>600 && getSelection().toString().includes("river bend")',
          'Distant text selected and scrolled into view',
        );
        caption = 'The whole passage is selected';
        keys = '';
        await capture(2);
      },
    ],
    [
      'move-between-matches',
      'Move between matches',
      async () => {
        await search('coffee');
        await press('Tab', 0, 'Tab', 'Move to the next text match');
        await check(`${status}.includes('Text 2 /')`, 'Tab advanced');
        await press('Tab', 8, 'Shift + Tab', 'Return to the previous match');
        await check(`${status}.includes('Text 1 /')`, 'Shift+Tab moved back');
      },
    ],
    [
      'choose-a-suggestion',
      'Choose a suggestion',
      async () => {
        await search('coffee');
        await press('3', 1, 'Alt / Option + 3', 'Jump to the third suggestion');
        await check(`${selected}.includes('Find your coffee spot')`, 'Third suggestion selected');
      },
    ],
    [
      'recover-from-a-typo',
      'Find it despite a typo',
      async () => {
        await search('cofee');
        await check(
          `${root}.querySelector('.keymove-suggestions').textContent.includes('coffee')`,
          'Typo resolved to page spelling',
        );
        keys = 'cofee → coffee';
        caption = 'Approximate matches rescue a missing letter';
        await capture(2);
      },
    ],
    [
      'follow-a-link',
      'Follow a link',
      async () => {
        await search('Open the checklist', true);
        await press('Enter', 0, 'Enter', 'Open the link in this tab');
        await check(
          "location.hash==='#checklist' && document.querySelector('#checklist').textContent.includes('Checklist opened')",
          'Link activated in current tab',
        );
      },
    ],
    [
      'activate-a-button',
      'Activate a button',
      async () => {
        await search('Save this guide');
        await press('Enter', 0, 'Enter', 'Save the guide');
        await check(
          "document.querySelector('.sample-actions button').getAttribute('aria-pressed')==='true'",
          'Button activated',
        );
      },
    ],
    [
      'act-through-text',
      'Act through associated text',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Pack a picnic');
        await press('Enter', 0, 'Enter', 'Toggle the checkbox through its label');
        await check("document.querySelector('#picnic').checked", 'Associated checkbox checked');
      },
    ],
    [
      'focus-a-field',
      'Focus a form field',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Your name', true);
        await press('Enter', 0, 'Enter', 'Hand focus to the name field');
        await check("document.activeElement.id==='visitor-name'", 'Name field focused');
        for (const c of 'Alex') await press(c, 0, c, 'Type directly into the field', 0.2);
        await check(
          "document.querySelector('#visitor-name').value==='Alex'",
          'Native field received typing',
        );
      },
    ],
    [
      'hand-off-to-widget',
      'Hand control to a widget',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Walking pace', true);
        await press('Enter', 0, 'Enter', 'Focus the dropdown');
        await check("document.activeElement.id==='walking-pace'", 'Dropdown focused');
        await press('ArrowDown', 0, 'Down', 'Use the dropdown’s own keyboard controls');
        await press('Enter', 0, 'Enter', 'Choose a leisurely pace');
        await check(
          "document.querySelector('#walking-pace').value==='Leisurely'",
          'Native dropdown value changed',
        );
      },
    ],
    [
      'expand-a-section',
      'Expand a collapsed section',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Rainy day ideas');
        await press('Enter', 0, 'Enter', 'Reveal the ideas inside');
        await check("document.querySelector('#rainy-day').open", 'Disclosure expanded');
        await search('glasshouse');
        await check(
          'getSelection().toString().includes("glasshouse")',
          'Revealed content searched',
        );
      },
    ],
    [
      'reveal-a-menu',
      'Search inside a hover menu',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Browse detours', true);
        await press('1', 1, 'Alt / Option + 1', 'Select the menu trigger to reveal its options');
        await check(
          "!document.querySelector('#detour-options').hidden",
          'Keyboard selection revealed hover menu',
        );
        await press(
          'a',
          2,
          'Ctrl / Command + A',
          'Replace the query without closing the menu',
          0.5,
        );
        await type('Garden detour', 'Search an option inside the open menu');
        await press('Enter', 0, 'Enter', 'Add the garden detour');
        await check(
          "document.querySelector('#checklist').textContent.includes('Garden detour added')",
          'Hover menu option activated',
        );
      },
    ],
    [
      'navigate-a-dialog',
      'Navigate inside a dialog',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Plan a visit');
        await press('Enter', 0, 'Enter', 'Open the visit dialog');
        await check("document.querySelector('dialog').open", 'Native modal opened');
        await search('Confirm visit');
        await check(
          "document.querySelector('dialog').contains(document.getElementById('keymove-root'))",
          'Search scoped inside modal',
        );
        await press('Enter', 0, 'Enter', 'Confirm and return to the page');
        await check(
          "!document.querySelector('dialog').open && document.querySelector('#visit-status').textContent.includes('confirmed')",
          'Modal action completed',
        );
      },
    ],
    [
      'return-to-origin',
      'Explore, then return',
      async () => {
        await search('river bend');
        await press('1', 1, 'Alt / Option + 1', 'Jump to the selected passage');
        await check('scrollY>600', 'Search left the original viewport');
        await press('Backspace', 1, 'Alt / Option + Backspace', 'Return to where you started');
        await check('scrollY<5', 'Original scroll position restored');
      },
    ],
    [
      'stay-here',
      'Stay where you landed',
      async () => {
        await search('river bend');
        await press('1', 1, 'Alt / Option + 1', 'Jump to the selected passage');
        const position = await page.evaluate('scrollY');
        await press('Escape', 0, 'Escape', 'Close KeyMove and keep reading here');
        await check(
          `Math.abs(scrollY-${position})<5 && ${input}.getClientRects().length===0`,
          'Search closed at the destination',
        );
      },
    ],
    [
      'copy-a-passage',
      'Copy a passage',
      async () => {
        await search('Leave the long list');
        await press('1', 1, 'Alt / Option + 1', 'Select the complete text block');
        await press('c', 2, 'Ctrl / Command + C', 'Copy the complete selected passage');
        await press('Escape', 0, 'Escape', 'Leave search and paste into your notes', 0.5);
        await page.evaluate("document.querySelector('#weekend-notes').focus()");
        await press('v', 2, 'Ctrl / Command + V', 'Paste the passage into Weekend notes');
        await check(
          "document.querySelector('#weekend-notes').value.includes('let the morning take its time')",
          'Native clipboard copied the full passage',
        );
      },
    ],
    [
      'copy-a-link',
      'Copy a link’s address',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Read the walking route', true);
        await press('c', 2, 'Ctrl / Command + C', 'Copy the link address');
        await press('Escape', 0, 'Escape', 'Leave search and paste into your notes', 0.5);
        await page.evaluate("document.querySelector('#weekend-notes').focus()");
        await press('v', 2, 'Ctrl / Command + V', 'Paste the complete URL');
        await check(
          "document.querySelector('#weekend-notes').value.endsWith('#riverside')",
          'Clipboard contains normalized link URL',
        );
      },
    ],
    [
      'choose-an-action',
      'Choose another action',
      async () => {
        await search('Open the checklist', true);
        await menu();
        await choose('Copy link address');
        await press('Escape', 0, 'Escape', 'Leave search and paste into your notes', 0.5);
        await page.evaluate("document.querySelector('#weekend-notes').focus()");
        await press('v', 2, 'Ctrl / Command + V', 'Paste the copied address');
        await check(
          "document.querySelector('#weekend-notes').value.endsWith('#checklist')",
          'Action menu copied actual URL',
        );
      },
    ],
    [
      'focus-without-activating',
      'Focus without activating',
      async () => {
        await search('Save this guide');
        await menu();
        await choose('Focus without activating');
        await check(
          "document.activeElement===document.querySelector('.sample-actions button') && document.activeElement.getAttribute('aria-pressed')==='false'",
          'Button focused without clicking',
        );
        caption = 'The button has focus; the guide is still unsaved';
        keys = '';
        await capture(2);
      },
    ],
    [
      'open-in-new-tab',
      'Open without losing your place',
      async () => {
        await scrollSetup('.sample-planner');
        await capture(0.8);
        await search('Read the walking route', true);
        const before = await popup.evaluate('chrome.tabs.query({})');
        await press('Enter', 2, 'Ctrl + Enter', 'Open a background tab and keep reading');
        const after = await popup.evaluate('chrome.tabs.query({})');
        const added = after.filter(t => !before.some(old => old.id === t.id));
        if (added.length !== 1 || added[0].active || !added[0].url.endsWith('#riverside'))
          throw new Error('Background tab was not created correctly');
        evidence.push('Installed extension created an inactive background tab');
        keys = 'Background tab opened';
        caption = 'The route opens in another tab; this page stays active';
        await capture(2);
        await press('f', 1, 'Alt / Option + F', 'Find the link again', 0.5);
        if (await page.evaluate(`${input}.value`))
          await press('a', 2, 'Ctrl / Command + A', 'Replace the query', 0.3);
        await type('Read the walking route');
        const beforeForeground = await client.sendCommand('Target.getTargets', {});
        await press('Enter', 8, 'Shift + Enter', 'Open another tab and switch to it');
        const next = await popup.evaluate('chrome.tabs.query({})');
        const foreground = next.find(t => !after.some(old => old.id === t.id));
        if (!foreground?.active || !foreground.url.endsWith('#riverside'))
          throw new Error('Foreground tab was not activated');
        evidence.push('Installed extension opened and activated the foreground tab');
        // Attach to the actual tab created by the extension; do not create a stand-in.
        const infos = await client.sendCommand('Target.getTargets', {});
        const target = infos.targetInfos.find(
          t =>
            t.url === foreground.url &&
            !beforeForeground.targetInfos.some(previous => previous.targetId === t.targetId),
        );
        if (!target) throw new Error('Could not identify the actual foreground tab target');
        const attached = await client.sendCommand('Target.attachToTarget', {
          targetId: target.targetId,
          flatten: true,
        });
        await client.sendCommand(
          'Emulation.setDeviceMetricsOverride',
          { width: 960, height: 640, deviceScaleFactor: 1, mobile: false },
          attached.sessionId,
        );
        await client.sendCommand(
          'Emulation.setEmulatedMedia',
          { features: [{ name: 'prefers-color-scheme', value: 'light' }] },
          attached.sessionId,
        );
        await delay(500);
        const shot = await client.sendCommand(
          'Page.captureScreenshot',
          { format: 'png' },
          attached.sessionId,
        );
        const filename = `${String(frames.length).padStart(4, '0')}.png`;
        writeFileSync(path.join(directory, filename), Buffer.from(shot.data, 'base64'));
        frames.push({
          filename,
          duration: 2.5,
          start: time,
          keys: 'Foreground tab active',
          caption: 'You are now reading the walking route',
        });
        time += 2.5;
        await popup.evaluate(
          `chrome.tabs.remove(${JSON.stringify([...added.map(t => t.id), foreground.id])})`,
        );
      },
    ],
  ];
  const only = process.argv[3];
  for (const [id, name, run] of plan) {
    if (only && !only.split(',').includes(id)) continue;
    title = name;
    frames = [];
    time = 0;
    caption = 'Start on the same weekend guide';
    keys = '';
    evidence.length = 0;
    directory = path.join(fileURLToPath(artifacts), id);
    mkdirSync(directory, { recursive: true });
    page = await openPage(client, base + 'demo.html?extension=installed');
    await page.activate();
    await page.setViewport(960, 640);
    await page.setColorScheme('light');
    await waitFor(
      page,
      `document.getElementById('keymove-root')?.shadowRoot?.querySelector('input')`,
    );
    await delay(700);
    await page.evaluate("document.documentElement.style.scrollBehavior='auto'");
    await page.evaluate('document.fonts.ready');
    await capture(0.7);
    try {
      await run();
      if (id !== 'open-in-new-tab') await capture(1.4);
      const concat =
        frames.map(f => `file '${f.filename}'\nduration ${f.duration}`).join('\n') +
        `\nfile '${frames.at(-1).filename}'\n`;
      writeFileSync(path.join(directory, 'frames.txt'), concat);
      const filters = ['pad=960:716:0:0:color=0x18151f'];
      for (const [index, f] of frames.entries()) {
        writeFileSync(path.join(directory, `key-${index}.txt`), f.keys || title);
        writeFileSync(path.join(directory, `caption-${index}.txt`), f.caption);
        filters.push(
          `drawtext=fontfile='${font.replaceAll('\\', '/').replace(':', '\\:')}':textfile=key-${index}.txt:x=22:y=654:fontsize=18:fontcolor=0xe9c7ff:enable='gte(t,${f.start})*lt(t,${f.start + f.duration})'`,
        );
        filters.push(
          `drawtext=fontfile='${font.replaceAll('\\', '/').replace(':', '\\:')}':textfile=caption-${index}.txt:x=22:y=681:fontsize=15:fontcolor=white:enable='gte(t,${f.start})*lt(t,${f.start + f.duration})'`,
        );
      }
      writeFileSync(path.join(directory, 'filters.txt'), filters.join(','));
      const encode = spawnSync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          'frames.txt',
          '-/filter:v',
          'filters.txt',
          '-r',
          '20',
          '-t',
          String(time),
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-crf',
          '21',
          '-movflags',
          '+faststart',
          path.join(output, id + '.mp4'),
        ],
        { cwd: directory, windowsHide: true, encoding: 'utf8' },
      );
      if (encode.status !== 0) throw new Error(encode.stderr);
      const poster = spawnSync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-ss',
          String((frames.find(f => f.duration === 1.7)?.start ?? 2) + 0.4),
          '-i',
          path.join(output, id + '.mp4'),
          '-frames:v',
          '1',
          '-update',
          '1',
          path.join(output, id + '.jpg'),
        ],
        { windowsHide: true, encoding: 'utf8' },
      );
      if (poster.status !== 0) throw new Error(poster.stderr);
      const cues = [];
      for (const f of frames) {
        const previous = cues.at(-1);
        if (previous?.caption === f.caption) previous.end = f.start + f.duration;
        else cues.push({ start: f.start, end: f.start + f.duration, caption: f.caption });
      }
      const stamp = seconds => new Date(seconds * 1000).toISOString().slice(11, 23);
      writeFileSync(
        path.join(output, id + '.vtt'),
        'WEBVTT\n\n' +
          cues.map(f => `${stamp(f.start)} --> ${stamp(f.end)}\n${f.caption}\n`).join('\n'),
      );
      const old = report.findIndex(r => r.id === id);
      if (old >= 0) report.splice(old, 1);
      report.push({ id, duration: time, evidence: [...evidence] });
      writeFileSync(new URL('verification.json', artifacts), JSON.stringify(report, null, 2));
      console.log('RECORDED', id, time.toFixed(1) + 's', evidence.join('; '));
    } catch (error) {
      writeFileSync(path.join(directory, 'failure.png'), await page.screenshot());
      throw error;
    } finally {
      await page.close();
    }
  }
  await client.sendCommand('Browser.close');
} finally {
  socket?.close();
  child.kill();
  preview.cleanup();
}
