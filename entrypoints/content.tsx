import { runSingleContentScript } from '../src/lib/content_script_lifecycle.js';
import '../src/highlights.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  // The started event is still dispatched on the document, but page script need not
  // be told its type. KeyMove does not trust it either way: see content_script_lifecycle.
  noScriptStartedPostMessage: true,
  main(ctx) {
    // React DOM reads `document.createElement('div').style` as soon as its code runs. An
    // XML document, such as a sitemap or feed, creates a plain Element without one, so
    // React threw before KeyMove started. The interface is loaded only where it can run.
    if (!(document.createElement('div') instanceof HTMLElement)) return;
    return import('../src/content_ui.js').then(({ default: mountSearch }) => {
      runSingleContentScript(ctx, 'content', mountSearch);
    });
  },
});
