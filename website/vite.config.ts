import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fromHere('.'),
  base: './',
  publicDir: false,
  plugins: [
    react(),
    svgr(),
    {
      name: 'website-static-files',
      configureServer(server) {
        server.middlewares.use('/LICENSE.txt', (_request, response) => {
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.end(readFileSync(fromHere('../LICENSE'), 'utf8'));
        });
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'LICENSE.txt',
          source: readFileSync(fromHere('../LICENSE'), 'utf8'),
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
    outDir: fromHere('../.output/public'),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: fromHere('./index.html'),
        demo: fromHere('./demo.html'),
        patterns: fromHere('./patterns.html'),
      },
    },
  },
});
