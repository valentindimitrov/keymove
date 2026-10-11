import { test } from './fixtures.js';
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

for (const [name, check] of scenarios) {
  test(name, async ({ context, fixtureOrigin }, testInfo) => {
    const measurements = await check(context, fixtureOrigin);
    if (measurements) {
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
    const report = await checkCore(context, fixtureOrigin, size);
    await testInfo.attach('core coverage and timings', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
  });
}
