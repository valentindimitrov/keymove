import assert from 'node:assert/strict';
import { record, records, targets as readTargets } from '../../scripts/capture-data.ts';
import type { PendingCommand } from '../../scripts/capture-data.ts';
import type { TestPage } from '../../scripts/browser-driver.ts';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { findBrowser } from '../../scripts/preview-extension.ts';
import { openPage, waitFor, boundedClient } from '../../scripts/browser-driver.ts';

const output = path.resolve('.artifacts/chrome-web-store');
const requested = new Set(process.argv.slice(2));
const includes = (name: string) => requested.size === 0 || requested.has(name);
const captions: Record<string, string> = {
  '01-text-search': 'Find text on any page',
  '02-dark-theme': 'Dark mode',
  '03-typo-matching': 'Find matches despite a typo',
  '04-action-menu': 'Choose an action for a link',
  '05-form-controls': 'Find controls by their labels',
};
mkdirSync(output, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), 'keymove-store-profile-'));
const build = mkdtempSync(path.join(tmpdir(), 'keymove-store-build-'));
cpSync('.output/chrome-mv3', build, { recursive: true });
const child = spawn(
  findBrowser('vivaldi').binary,
  [
    '--headless=new',
    '--disable-extensions-except=' + build,
    '--load-extension=' + build,
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--window-size=1800,1200',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket: WebSocket | undefined;
const report: { file: string; width: number; height: number; caption?: string }[] = [];
try {
  for (let i = 0; i < 150 && !existsSync(path.join(profile, 'DevToolsActivePort')); i++)
    await delay(100);
  const [port, endpoint] = readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8')
    .trim()
    .split('\n');
  const connection = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  socket = connection;
  await new Promise<void>((resolve, reject) => {
    connection.onopen = () => resolve();
    connection.onerror = reject;
  });
  let id = 0;
  const pending = new Map<number, PendingCommand>();
  connection.onmessage = (e: MessageEvent<string>) => {
    const r = record(JSON.parse(e.data));
    if (typeof r.id === 'number') {
      const p = pending.get(r.id);
      if (!p) return;
      pending.delete(r.id);
      r.error ? p.reject(r.error) : p.resolve(r.result);
    }
  };
  let shotWidth = 1280,
    shotHeight = 800,
    shotX = 0,
    shotY = 0;
  const client = boundedClient({
    sendCommand(method, params, sessionId) {
      if (method === 'Page.captureScreenshot')
        params = {
          ...params,
          captureBeyondViewport: true,
          clip: { x: shotX, y: shotY, width: shotWidth, height: shotHeight, scale: 1 },
        };
      return new Promise<unknown>((resolve, reject) => {
        const request = ++id;
        pending.set(request, { resolve, reject });
        connection.send(JSON.stringify({ id: request, method, params, sessionId }));
      });
    },
  });
  let worker: ReturnType<typeof readTargets>[number] | undefined;
  for (let i = 0; i < 150 && !worker; i++) {
    const targets = readTargets(await client.sendCommand('Target.getTargets', {}));
    worker = targets.find(t => t.type === 'service_worker' && t.url.endsWith('/background.js'));
    if (!worker) await delay(100);
  }
  if (!worker) throw new Error('Installed extension worker unavailable');
  const popup = await openPage(client, new URL('popup.html', worker.url).href);
  const settings = async (theme: string) =>
    popup.evaluate(
      `chrome.storage.local.set({autoHide:false,alwaysOn:false,theme:${JSON.stringify(theme)},popupPosition:{x:.5,y:.70},popupWidth:510})`,
    );
  const root = "document.getElementById('keymove-root')?.shadowRoot";
  const save = async (page: TestPage, name: string, width = 1280, height = 800) => {
    shotWidth = width;
    shotHeight = height;
    await page.setViewport(width, height);
    await page.evaluate('document.fonts.ready.then(()=>true)');
    await delay(650);
    const scroll = record(await page.evaluate('({x: scrollX, y: scrollY})'));
    assert(typeof scroll.x === 'number' && typeof scroll.y === 'number');
    shotX = scroll.x;
    shotY = scroll.y;
    const raw = path.join(output, name + '.raw.png');
    writeFileSync(raw, await page.screenshot());
    const final = path.join(output, name + '.png');
    const caption = captions[name];
    const converted = spawnSync(
      'magick',
      [
        raw,
        '-background',
        '#ffffff',
        '-alpha',
        'remove',
        '-alpha',
        'off',
        ...(caption
          ? [
              '-fill',
              '#211830',
              '-stroke',
              '#6e4b89',
              '-strokewidth',
              '1',
              '-draw',
              'roundrectangle 380,18 900,84 18,18',
              '-font',
              'C:/Windows/Fonts/arialbd.ttf',
              '-pointsize',
              '28',
              '-fill',
              '#ffffff',
              '-stroke',
              'none',
              '-gravity',
              'North',
              '-annotate',
              '+0+41',
              caption,
            ]
          : []),
        '-depth',
        '8',
        'PNG24:' + final,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    if (converted.status !== 0) throw new Error(converted.stderr);
    report.push({
      file: name + '.png',
      width,
      height,
      ...(caption ? { caption: caption } : {}),
    });
    console.log('Created ' + name + '.png');
  };
  const search = async (query: string, theme = 'light', actions = false, menu = false) => {
    await settings(theme);
    if (menu) await popup.evaluate('chrome.storage.local.set({popupPosition:{x:.25,y:.8}})');
    const page = await openPage(client, 'http://127.0.0.1:5180/demo.html?extension=installed');
    await page.setViewport(1280, 800);
    await page.setColorScheme('light');
    await waitFor(page, `!!${root}`);
    await page.activate();
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.key('f', 1);
      if (
        await page.evaluate(
          `!!${root}.querySelector('input') && ${root}.activeElement === ${root}.querySelector('input')`,
        )
      )
        break;
      await delay(250);
    }
    await waitFor(
      page,
      `!!${root}.querySelector('input') && ${root}.activeElement === ${root}.querySelector('input')`,
    );
    if (actions) await page.key('s', 1);
    for (const c of query) await page.key(c);
    await waitFor(page, `!!${root}.querySelector('.keymove-suggestion')`);
    if (menu) {
      await page.key('ArrowDown');
      await waitFor(page, `!!${root}.querySelector('[role=menu]')`);
      await waitFor(
        page,
        `(() => {
        const link = document.querySelector('.sample-checklist a[href="#checklist"]').getBoundingClientRect();
        const menu = ${root}.querySelector('[role=menu]').getBoundingClientRect();
        return link.top >= 100 && link.bottom < innerHeight && menu.right + 20 < link.left;
      })()`,
      );
    }
    return page;
  };
  if (includes('01-text-search')) await save(await search('coffee'), '01-text-search');
  if (includes('02-dark-theme')) await save(await search('coffee', 'dark'), '02-dark-theme');
  if (includes('03-typo-matching')) await save(await search('cofee'), '03-typo-matching');
  if (includes('04-action-menu'))
    await save(await search('Open the checklist', 'light', true, true), '04-action-menu');
  if (includes('05-form-controls')) {
    const page = await search('Your name', 'light', true);
    await page.evaluate(`(() => {
      const field = document.querySelector('#visitor-name');
      window.scrollTo({top: field.getBoundingClientRect().top + scrollY - 330, behavior: 'instant'});
    })()`);
    await waitFor(
      page,
      `(() => {
      const bounds = document.querySelector('#visitor-name').getBoundingClientRect();
      return bounds.top >= 250 && bounds.bottom < 450;
    })()`,
    );
    await save(page, '05-form-controls');
  }
  const logo = 'data:image/png;base64,' + readFileSync('assets/logo-192.png').toString('base64');
  for (const [name, w, h] of [
    ['small-promo-tile', 440, 280],
    ['marquee-promo-tile', 1400, 560],
  ] as const) {
    if (!includes(name)) continue;
    const small = w === 440;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:radial-gradient(ellipse at 92% 0%,#5e246c 0%,transparent 55%),radial-gradient(ellipse at 0% 100%,#302564 0%,transparent 58%),#151224;color:#fff;font-family:Arial,sans-serif}.layout{height:100%;display:flex;align-items:center;padding:${small ? '38px' : '80px 110px'};gap:${small ? '22px' : '66px'}}.logo{width:${small ? '84px' : '185px'};height:auto;filter:drop-shadow(0 12px 28px #cb38d63a)}h1{font-size:${small ? '36px' : '86px'};letter-spacing:-2px;margin:0;font-weight:700}.tag{font-size:${small ? '14px' : '28px'};color:#ded6ef;line-height:1.5;margin:${small ? '9px' : '18px'} 0 0}.keys{display:flex;gap:${small ? '8px' : '14px'};margin-top:${small ? '22px' : '32px'}}kbd{font-family:Arial,sans-serif;font-size:${small ? '12px' : '21px'};border:1px solid #817392;background:#ffffff0c;border-radius:9px;padding:${small ? '8px 11px' : '16px 22px'};box-shadow:0 4px 0 #080713;color:#f1eafa}.orb{position:absolute;right:-115px;top:-160px;width:430px;height:430px;border:1px solid #df5fe52a;border-radius:50%;pointer-events:none}</style></head><body><div class="orb"></div><div class="layout"><img class="logo" src="${logo}" alt=""><div><h1>KeyMove</h1><p class="tag">${small ? 'Find. Jump. Act.' : 'Find your way. Keep your hands on the keys.'}</p><div class="keys"><kbd>Alt + F</kbd><kbd>Tab</kbd><kbd>Enter</kbd></div></div></div></body></html>`;
    const file = path.join(output, name + '.html');
    const smallTileStyles = small
      ? 'body{background:radial-gradient(ellipse at 100% 0%,#63277370,transparent 70%),radial-gradient(ellipse at 0% 100%,#40307a80,transparent 75%),linear-gradient(135deg,#171327,#211830)}.layout{justify-content:center;padding:0}.orb{display:none}'
      : '';
    writeFileSync(
      file,
      html.replace('</style>', `${smallTileStyles}#keymove-root{display:none!important}</style>`),
    );
    const page = await openPage(client, pathToFileURL(file).href);
    await page.setViewport(w, h);
    await delay(500);
    await page.key('Escape');
    await save(page, name, w, h);
  }
  const destination = path.resolve('assets/store-listings/chrome-web-store');
  const previousReport = existsSync(path.join(destination, 'verification.json'))
    ? records(
        record(JSON.parse(readFileSync(path.join(destination, 'verification.json'), 'utf8')))
          .images,
      )
    : [];
  const images = requested.size
    ? previousReport.map(entry => report.find(image => image.file === entry.file) ?? entry)
    : report;
  const manifest = record(JSON.parse(readFileSync(path.join(build, 'manifest.json'), 'utf8')));
  assert(typeof manifest.version === 'string');
  writeFileSync(
    path.join(output, 'verification.json'),
    JSON.stringify(
      {
        capturedFrom: 'Installed production Chromium extension on the KeyMove sample page',
        buildVersion: manifest.version,
        images,
      },
      null,
      2,
    ) + '\n',
  );
  mkdirSync(destination, { recursive: true });
  for (const { file } of report) cpSync(path.join(output, file), path.join(destination, file));
  cpSync(path.join(output, 'verification.json'), path.join(destination, 'verification.json'));
  console.log('All store images saved in ' + destination);
} finally {
  if (socket?.readyState === 1) socket.close();
  child.kill();
  console.log(
    'Dedicated browser closed. Temporary profile/build retained: ' + profile + ' ; ' + build,
  );
}
