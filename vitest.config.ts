import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [svgr(), react()],
  test: {
    environment: 'jsdom',
    // Avoid oversubscribing memory and DOM initialization when the suite runs on high-core hosts.
    maxWorkers: 4,
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
});
