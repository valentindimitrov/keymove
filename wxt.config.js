import { defineConfig } from 'wxt';
import svgr from 'vite-plugin-svgr';

const icons = {
  16: 'logo-16.png',
  24: 'logo-24.png',
  32: 'logo-32.png',
  48: 'logo-48.png',
  64: 'logo-64.png',
  128: 'logo-128.png',
  192: 'logo-192.png'
};

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [svgr()]
  }),
  manifest: ({ browser, manifestVersion }) => ({
    name: 'YipYip',
    short_name: 'YipYip',
    description: 'Never touch your mouse again!',
    icons,
    action: {
      default_icon: icons,
      default_title: 'Search with YipYip!'
    },
    permissions: manifestVersion === 3
      ? ['storage', 'scripting']
      : ['storage', '<all_urls>'],
    host_permissions: manifestVersion === 3 ? ['*://*/*'] : undefined,
    browser_specific_settings: browser === 'firefox'
      ? {
          gecko: {
            ...(process.env.WXT_FIREFOX_EXTENSION_ID
              ? { id: process.env.WXT_FIREFOX_EXTENSION_ID }
              : {}),
            data_collection_permissions: {
              required: ['none']
            }
          }
        }
      : undefined
  }),
  zip: {
    name: 'yipyip',
    artifactTemplate: '{{name}}-v{{version}}-{{browser}}-{{manifestVersion}}.zip',
    sourcesTemplate: '{{name}}-v{{version}}-sources.zip',
    excludeSources: [
      '.output/**',
      '.wxt/**',
      'build/**',
      'coverage/**',
      'dist/**',
      'firefox_build/**'
    ]
  }
});
