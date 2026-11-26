import path from 'node:path';
import { defineConfig } from 'wxt';
import svgr from 'vite-plugin-svgr';
import type { Plugin } from 'vite';
import EXTENSION_IDENTITY from './src/extension_identity.js';

const icons = {
  16: 'logo-16.png',
  24: 'logo-24.png',
  32: 'logo-32.png',
  48: 'logo-48.png',
  64: 'logo-64.png',
  96: 'logo-96.png',
  128: 'logo-128.png',
  192: 'logo-192.png',
};

/**
 * A test build (`--mode test`) differs from production only in leaving KeyMove's shadow
 * roots open, so it keeps React's production build. WXT defines NODE_ENV as the mode in
 * each entrypoint's config; a plugin's config hook is merged over that. Vitest also runs
 * in test mode, but serves rather than builds, and needs React's development build.
 */
function productionReactInTestBuilds(): Plugin {
  return {
    name: 'keymove-production-react-in-test-builds',
    config: (_config, env) => {
      if (env.mode !== 'test' || env.command !== 'build') return undefined;
      // Vite decides production behaviour, such as the JSX runtime, from NODE_ENV after
      // config hooks run; WXT set it to the mode before.
      process.env['NODE_ENV'] = 'production';
      return { define: { 'process.env.NODE_ENV': JSON.stringify('production') } };
    },
  };
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  publicDir: 'assets',
  hooks: {
    'build:publicAssets': (wxt, files) => {
      // Store marketing files live alongside icons but never ship in the extension.
      for (let index = files.length - 1; index >= 0; index--) {
        const file = files[index];
        if (file?.relativeDest.replaceAll('\\', '/').startsWith('store-listings/')) {
          files.splice(index, 1);
        }
      }
      files.push({
        absoluteSrc: path.resolve(wxt.config.root, 'LICENSE'),
        relativeDest: 'LICENSE',
      });
    },
  },
  vite: env => ({
    plugins: [svgr(), productionReactInTestBuilds()],
    // Test builds keep KeyMove's shadow roots open for the browser suite (SECURITY.md).
    define: { __KEYMOVE_OPEN_SHADOW_ROOTS__: JSON.stringify(env.mode === 'test') },
  }),
  manifest: ({ browser, mode }) => ({
    // Marks a test build in the browser's extension list. Build validation compares the
    // name with the identity, so a test build packaged as a release fails it.
    name: mode === 'test' ? `${EXTENSION_IDENTITY.name} (test build)` : EXTENSION_IDENTITY.name,
    short_name: EXTENSION_IDENTITY.shortName,
    description: EXTENSION_IDENTITY.description,
    icons,
    action: {
      default_icon: icons,
      default_title: EXTENSION_IDENTITY.toolbarTitle,
    },
    permissions: ['storage', 'scripting'],
    host_permissions: ['*://*/*'],
    browser_specific_settings:
      browser === 'firefox'
        ? {
            gecko: {
              ...(process.env['WXT_FIREFOX_EXTENSION_ID']
                ? { id: process.env['WXT_FIREFOX_EXTENSION_ID'] }
                : {}),
              data_collection_permissions: {
                required: ['none'],
              },
            },
          }
        : undefined,
  }),
  zip: {
    name: EXTENSION_IDENTITY.artifactName,
    // {{modeSuffix}} is empty for production; a test build's ZIP ends in -test, so it can
    // never take the release ZIP's name, which signing and the release workflow use.
    artifactTemplate: '{{name}}-v{{version}}-{{browser}}-{{manifestVersion}}{{modeSuffix}}.zip',
    sourcesTemplate: '{{name}}-v{{version}}-sources{{modeSuffix}}.zip',
    excludeSources: ['.output/**', '.wxt/**', 'coverage/**'],
  },
});
