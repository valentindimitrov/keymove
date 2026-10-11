import { access, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createPreviewCopy } from '../../scripts/preview-extension.js';
import { launchExtensionContext } from '../../scripts/browser-context.js';

const root = path.resolve(import.meta.dirname, '../..');
const git = (args: string[]) => {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
  });
  return result.status === 0 ? result.stdout.trim() : null;
};
const commit = git(['rev-parse', 'HEAD']);
const workingChanges = git(['status', '--porcelain']);

export const test = base.extend<{}, { fixtureOrigin: string }>({
  fixtureOrigin: [
    // Playwright parses fixture dependencies from this destructuring pattern.
    // oxlint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      const server = await createServer({
        configFile: path.join(root, 'preview/vite.config.ts'),
        server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
        plugins: [
          {
            name: 'browser-fixture-favicon',
            configureServer(server) {
              server.middlewares.use((request, response, next) => {
                if (request.url !== '/favicon.ico') return next();
                response.statusCode = 204;
                response.end();
              });
            },
          },
        ],
      });
      try {
        await server.listen();
        const origin = server.resolvedUrls?.local[0];
        if (!origin) throw new Error('The browser fixture server did not expose its address.');
        await provide(origin);
      } finally {
        await server.close();
      }
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ fixtureOrigin }, provide) => {
    await provide(fixtureOrigin);
  },
  context: async ({ headless, baseURL }, provide, testInfo) => {
    await mkdir(path.join(root, '.artifacts'), { recursive: true });
    const build = path.join(root, '.output/chrome-mv3');
    await access(path.join(build, 'manifest.json')).catch(() => {
      throw new Error('Build missing. Run pnpm test:e2e or pnpm build:chromium first.');
    });
    const preview = createPreviewCopy(build);
    try {
      // Empty userDataDir creates a fresh temporary profile for each test. Never
      // use a regular browser profile or the mutable production build directly.
      const context = await launchExtensionContext(
        preview.directory,
        process.env['KEYMOVE_TEST_BROWSER'] ?? 'chromium',
        headless,
        baseURL,
      );
      context.setDefaultTimeout(10000);
      context.setDefaultNavigationTimeout(15000);
      await testInfo.attach('browser runtime', {
        body: JSON.stringify({
          recordedAt: new Date().toISOString(),
          browser: process.env['KEYMOVE_TEST_BROWSER'] ?? 'chromium',
          browserVersion: context.browser()?.version(),
          node: process.version,
          commit,
          dirty: workingChanges === null ? null : workingChanges.length > 0,
          vivaldiChromiumShell: process.env['KEYMOVE_TEST_BROWSER'] === 'vivaldi',
        }),
        contentType: 'application/json',
      });
      const errors: string[] = [];
      context.on('weberror', event => errors.push(event.error().message));
      context.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      try {
        await provide(context);
        expect(errors, 'Browser console errors and uncaught exceptions').toEqual([]);
      } finally {
        if (errors.length)
          await testInfo.attach('browser errors', {
            body: JSON.stringify(errors),
            contentType: 'application/json',
          });
        await context.close();
      }
    } finally {
      preview.cleanup();
    }
  },
  page: async ({ context }, provide) => {
    // Persistent Chromium starts with a blank tab. Reuse it so CLI debugging
    // attaches to the actual test page instead of a spare about:blank tab.
    const page = context.pages()[0] ?? (await context.newPage());
    await provide(page);
  },
});

export { expect };
