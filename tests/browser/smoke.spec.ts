import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { testBrowser } from '../../scripts/browser-context.js';
import type { BrowserContext } from '@playwright/test';
import { test } from './fixtures.js';
import { attachFailure } from './pages.js';
import { checkCore } from './scenarios/core-smoke.js';
import { checkContextNavigation } from './scenarios/context-navigation-smoke.js';
import { checkRenderedText } from './scenarios/rendered-text-smoke.js';
import { checkControlNavigation } from './scenarios/control-navigation-smoke.js';
import { checkActionMenu } from './scenarios/action-menu-smoke.js';
import { checkRelatedImages } from './scenarios/image-navigation-smoke.js';
import { checkDynamicPage } from './scenarios/dynamic-page-smoke.js';
import { checkShadowSearch } from './scenarios/shadow-search-smoke.js';
import { checkSelectionHover } from './scenarios/selection-hover-smoke.js';
import { checkHighlightDensity } from './scenarios/highlight-density-smoke.js';
import { checkIframes, measureIframes } from './scenarios/iframe-smoke.js';
import { checkActionFallback } from './scenarios/action-fallback-smoke.js';
import { checkThemePreviews } from './scenarios/theme-smoke.js';

// Each scenario keeps its order and assertions from the former CDP smoke suite; the
// coverage map in docs/browser-testing.md links each old check to its test here.
const scenarios = [
  ['related images: discovery, spatial navigation, actions and viewer', checkRelatedImages],
  ['frames: search, input focus, shortcuts, hidden frames and cleanup', checkIframes],
  ['frames: local-first timing with 0, 3 and 20 children', measureIframes],
  ['highlight density and short-query mixed suggestions', checkHighlightDensity],
  [
    'selection hover: automatic selection, menus, pointer takeover and cleanup',
    checkSelectionHover,
  ],
  ['temporary action fallback and return to text navigation', checkActionFallback],
  ['open shadow roots: slots, copy, editing, mutations and nested modals', checkShadowSearch],
  ['dynamic page: search timing, animation and isolated interface clicks', checkDynamicPage],
  ['appearance: light/dark, narrow/desktop, suggestions and settings layouts', checkThemePreviews],
  ['action menu: keyboard, copy/paste, activation, focus and layout', checkActionMenu],
  [
    'controls: labels, native widgets, disabled actions and transformed modals',
    checkControlNavigation,
  ],
  ['rendered whitespace: search, highlights and native clipboard agree', checkRenderedText],
  ['context navigation: scroll placement and independent browser tabs', checkContextNavigation],
] as const;

// Timing samples from this run, written to .artifacts/ for comparison between runs.
const timings: Record<string, unknown> = {};
let browserVersion: string | null = null;

test.afterAll(() => {
  if (!Object.keys(timings).length) return;
  const root = path.resolve(import.meta.dirname, '../..');
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    return result.status === 0 ? result.stdout.trim() : null;
  };
  const changes = git(['status', '--porcelain']);
  const browser = testBrowser();
  const directory = path.join(root, '.artifacts/playwright', browser);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'timings.json'),
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser,
        browserVersion,
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        commit: git(['rev-parse', 'HEAD']),
        dirty: changes === null ? null : changes.length > 0,
        ...timings,
      },
      null,
      2,
    ) + '\n',
  );
});

/** Attaches every page still open when a scenario fails, then rethrows its error. */
function diagnose(context: BrowserContext) {
  return async (error: unknown): Promise<never> => {
    for (const page of context.pages()) await attachFailure(page);
    throw error;
  };
}

for (const [name, check] of scenarios) {
  test(name, async ({ context, fixtureOrigin }, testInfo) => {
    browserVersion = context.browser()?.version() ?? null;
    const measurements = await check(context, fixtureOrigin).catch(diagnose(context));
    if (measurements) {
      timings[name] = measurements;
      await testInfo.attach('browser measurements', {
        body: JSON.stringify(measurements, null, 2),
        contentType: 'application/json',
      });
    }
  });
}

for (const size of ['small', 'large']) {
  test(`core smoke (${size}): typing, timing, native selection, navigation and live settings`, async ({
    context,
    fixtureOrigin,
  }, testInfo) => {
    browserVersion = context.browser()?.version() ?? null;
    const report = await checkCore(context, fixtureOrigin, size).catch(diagnose(context));
    timings[`core ${size}`] = report.measurements;
    await testInfo.attach('core coverage and timings', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
  });
}
