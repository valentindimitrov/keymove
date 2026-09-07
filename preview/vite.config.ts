import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// Serves the shadow-DOM harness. Deliberately plain Vite rather than a browser or an
// extension build: anything that can open a URL can use it, including a person, a CI job,
// or a coding agent taking screenshots.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), svgr()],
  server: { port: 5174, strictPort: true, open: false },
});
