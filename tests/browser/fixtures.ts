import { access } from 'node:fs/promises';
import path from 'node:path';
import { chromium, test as base, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createPreviewCopy } from '../../scripts/preview-extension.js';

const root = path.resolve(import.meta.dirname, '../..');

export const test = base.extend<{ extensionId: string }, { fixtureOrigin: string }>({
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
  context: async ({ headless, viewport, baseURL }, provide) => {
    const build = path.join(root, '.output/chrome-mv3');
    await access(path.join(build, 'manifest.json')).catch(() => {
      throw new Error('Build missing. Run pnpm test:e2e or pnpm build:chromium first.');
    });
    const preview = createPreviewCopy(build);
    try {
      // Empty userDataDir creates a fresh temporary profile for each test. Never
      // use a regular browser profile or the mutable production build directly.
      const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        headless,
        viewport,
        ...(baseURL ? { baseURL } : {}),
        args: [
          `--disable-extensions-except=${preview.directory}`,
          `--load-extension=${preview.directory}`,
        ],
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
        await context.close();
      }
    } finally {
      preview.cleanup();
    }
  },
  extensionId: async ({ context }, provide) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).hostname;
    if (!id) throw new Error('The installed extension did not expose its service worker.');
    await provide(id);
  },
  page: async ({ context }, provide) => {
    // Persistent Chromium starts with a blank tab. Reuse it so CLI debugging
    // attaches to the actual test page instead of a spare about:blank tab.
    const page = context.pages()[0] ?? (await context.newPage());
    await provide(page);
  },
});

export { expect };
