import { resolve } from 'node:path';
import { createServer, normalizePath, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Render the same page components used by the client, with production asset URLs.
// This is build-time only: the deployed site remains entirely static.
export function prerenderPages(root: string): Plugin {
  return {
    name: 'website-prerender',
    apply: 'build',
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const assets = new Map<string, string>();
        for (const output of Object.values(bundle)) {
          if (output.type !== 'asset') continue;
          for (const original of output.originalFileNames) {
            assets.set(normalizePath(resolve(root, original)), `/${output.fileName}`);
          }
        }
        const server = await createServer({
          configFile: false,
          root,
          appType: 'custom',
          publicDir: false,
          server: { middlewareMode: true, watch: null, hmr: false },
          optimizeDeps: { noDiscovery: true, include: [] },
          plugins: [
            {
              name: 'prerender-production-assets',
              enforce: 'pre',
              load(id) {
                const filename = normalizePath(id.split('?')[0] ?? id);
                if (!/\.(png|svg|jpg|mp4|vtt)$/.test(filename)) return;
                const url = assets.get(filename);
                if (!url) throw new Error(`Missing production asset for ${filename}`);
                return `export default ${JSON.stringify(url)}`;
              },
            },
            react(),
          ],
        });
        try {
          const module = await server.ssrLoadModule('/prerender.tsx');
          const pages = module.render() as Record<string, Record<string, string>>;
          for (const [filename, mounts] of Object.entries(pages)) {
            const output = bundle[filename];
            if (output?.type !== 'asset' || typeof output.source !== 'string') {
              throw new Error(`Missing HTML output: ${filename}`);
            }
            for (const [id, markup] of Object.entries(mounts)) {
              const placeholder = `<div id="${id}"></div>`;
              if (!output.source.includes(placeholder)) {
                throw new Error(`Missing ${id} mount in ${filename}`);
              }
              output.source = output.source.replace(
                placeholder,
                () => `<div id="${id}">${markup}</div>`,
              );
            }
          }
        } finally {
          await server.close();
        }
      },
    },
  };
}
