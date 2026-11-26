import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [svgr(), react()],
  // Unit tests look inside KeyMove's shadow roots; shipped builds close them.
  define: { __KEYMOVE_OPEN_SHADOW_ROOTS__: 'true' },
  test: {
    exclude: [...configDefaults.exclude, 'tests/browser/**'],
    environment: 'jsdom',
    // Avoid oversubscribing memory and DOM initialization when the suite runs on high-core hosts.
    maxWorkers: 4,
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // The CSS regressions read their inputs through fs, outside Vite's import graph.
    forceRerunTriggers: [
      ...configDefaults.forceRerunTriggers,
      '**/src/content.css',
      '**/src/popup.css',
      '**/pnpm-lock.yaml',
    ],
  },
});
