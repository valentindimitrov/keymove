import path from 'node:path';
import { defineConfig } from 'wxt';
import svgr from 'vite-plugin-svgr';
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

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  publicDir: 'assets',
  hooks: {
    'build:publicAssets': (wxt, files) => {
      files.push({
        absoluteSrc: path.resolve(wxt.config.root, 'LICENSE'),
        relativeDest: 'LICENSE',
      });
    },
  },
  vite: () => ({
    plugins: [svgr()],
  }),
  manifest: ({ browser }) => ({
    name: EXTENSION_IDENTITY.name,
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
    artifactTemplate: '{{name}}-v{{version}}-{{browser}}-{{manifestVersion}}.zip',
    sourcesTemplate: '{{name}}-v{{version}}-sources.zip',
    excludeSources: ['.output/**', '.wxt/**', 'coverage/**'],
  },
});
