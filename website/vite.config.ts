import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import identity from '../src/extension_identity.js';
import { prerenderPages } from './prerender-plugin.js';

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const websiteLicense = () =>
  ['../LICENSE', './fonts/DM-Sans-OFL.txt', './fonts/Manrope-OFL.txt']
    .map(path => readFileSync(fromHere(path), 'utf8'))
    .join('\n\n');

export default defineConfig({
  root: fromHere('.'),
  base: '/',
  publicDir: fromHere('./public'),
  plugins: [
    react(),
    svgr(),
    prerenderPages(fromHere('.')),
    {
      name: 'website-static-files',
      transformIndexHtml(html, context) {
        const transformed = html.replaceAll('__KEYMOVE_CONTACT_EMAIL__', identity.contactEmail);
        if (normalizePath(context.filename) !== normalizePath(fromHere('./index.html'))) {
          return transformed;
        }
        return {
          html: transformed,
          tags: [
            {
              tag: 'script',
              attrs: { type: 'application/ld+json' },
              children: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: identity.name,
                url: 'https://keymove.minddevops.eu/',
              }).replaceAll('<', '\\u003c'),
              injectTo: 'head',
            },
          ],
        };
      },
      configureServer(server) {
        server.middlewares.use('/LICENSE.txt', (_request, response) => {
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(websiteLicense());
        });
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'LICENSE.txt',
          source: websiteLicense(),
        });
        // Fixed, unhashed name: index.html's og:image points at this absolute URL.
        this.emitFile({
          type: 'asset',
          fileName: 'social-card.png',
          source: readFileSync(fromHere('./media/social-card.png')),
        });
      },
    },
  ],
  resolve: { alias: { 'wxt/browser': fromHere('./browser-adapter.ts') } },
  server: { host: '127.0.0.1', port: 5180, strictPort: true, open: false },
  build: {
    // Shared URLs keep build-time markup and client hydration in agreement.
    assetsInlineLimit: 0,
    outDir: fromHere('../.output/public'),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: fromHere('./index.html'),
        demo: fromHere('./demo.html'),
        patterns: fromHere('./patterns.html'),
        gettingStarted: fromHere('./getting-started.html'),
        privacy: fromHere('./privacy-policy.html'),
      },
    },
  },
});
